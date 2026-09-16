'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ValueProposition {
  id: number;
  title: string;
  segment: string;
  customer_jobs: string[];
  pains: string[];
  gains: string[];
  products_services: string[];
  pain_relievers: string[];
  gain_creators: string[];
  fit_score: number;
  status: string;
  channel: string | null;
  version: number;
  notes: string | null;
  created_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const GLASS = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const TAB_ACTIVE = 'bg-white/20 text-white rounded-lg px-4 py-2 text-sm font-medium';
const TAB_INACTIVE = 'text-white/60 hover:bg-white/10 rounded-lg px-4 py-2 text-sm font-medium transition-colors';

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-500/20 text-gray-300 border-gray-500/30',
  validated: 'bg-blue-500/20 text-blue-200 border-blue-500/30',
  live:      'bg-green-500/20 text-green-200 border-green-500/30',
  archived:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

const STATUSES = ['draft','validated','live','archived'];
const TABS = ['Value Map Canvas','All Propositions','Create / Edit','Fit Analysis','Segment Comparison'];

function fitColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function fitBg(score: number): string {
  if (score >= 70) return 'bg-green-500/20 border-green-500/40';
  if (score >= 40) return 'bg-yellow-500/20 border-yellow-500/40';
  return 'bg-red-500/20 border-red-500/40';
}

function parseTagInput(val: string): string[] {
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

function joinTags(arr: string[]): string {
  return arr.join(', ');
}

// ─── Component ─────────────────────────────────────────────────────────────

const emptyForm = {
  id: '',
  title: '',
  segment: '',
  customer_jobs: '',
  pains: '',
  gains: '',
  products_services: '',
  pain_relievers: '',
  gain_creators: '',
  fit_score: '50',
  status: 'draft',
  channel: '',
  notes: '',
};

export default function ValuePropositionPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [propositions, setPropositions] = useState<ValueProposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [aiSuggestion, setAiSuggestion] = useState<Record<number, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/value-proposition');
      if (res.ok) {
        const d = await res.json();
        setPropositions(d.propositions ?? []);
        if (d.propositions?.length > 0 && selectedId === null) {
          setSelectedId(d.propositions[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);

  const selected = propositions.find(p => p.id === selectedId) ?? propositions[0] ?? null;

  function editVP(vp: ValueProposition) {
    setForm({
      id: String(vp.id),
      title: vp.title,
      segment: vp.segment,
      customer_jobs: joinTags(vp.customer_jobs),
      pains: joinTags(vp.pains),
      gains: joinTags(vp.gains),
      products_services: joinTags(vp.products_services),
      pain_relievers: joinTags(vp.pain_relievers),
      gain_creators: joinTags(vp.gain_creators),
      fit_score: String(vp.fit_score),
      status: vp.status,
      channel: vp.channel ?? '',
      notes: vp.notes ?? '',
    });
    setActiveTab(2);
  }

  async function cloneVP(vp: ValueProposition) {
    await fetch('/api/admin/value-proposition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...vp,
        title: `${vp.title} (Copy)`,
        status: 'draft',
        version: 1,
      }),
    });
    await load();
  }

  async function archiveVP(vp: ValueProposition) {
    await fetch('/api/admin/value-proposition', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: vp.id, status: 'archived' }),
    });
    await load();
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      id: form.id ? Number(form.id) : undefined,
      customer_jobs: parseTagInput(form.customer_jobs),
      pains: parseTagInput(form.pains),
      gains: parseTagInput(form.gains),
      products_services: parseTagInput(form.products_services),
      pain_relievers: parseTagInput(form.pain_relievers),
      gain_creators: parseTagInput(form.gain_creators),
      fit_score: Number(form.fit_score),
    };
    const method = form.id ? 'PATCH' : 'POST';
    await fetch('/api/admin/value-proposition', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setForm(emptyForm);
    await load();
    setActiveTab(1);
  }

  async function askAI(vp: ValueProposition) {
    setAiLoading(p => ({ ...p, [vp.id]: true }));
    try {
      const gaps = {
        missingRelievers: vp.pains.filter((_,i) => !vp.pain_relievers[i]),
        missingCreators: vp.gains.filter((_,i) => !vp.gain_creators[i]),
      };
      const prompt = `For the "${vp.title}" value proposition targeting "${vp.segment}":
Pains without relievers: ${gaps.missingRelievers.join(', ') || 'none'}
Gains without creators: ${gaps.missingCreators.join(', ') || 'none'}
Suggest specific pain relievers and gain creators to close these gaps. Be concise and actionable.`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 300 }),
      });
      const d = await res.json();
      setAiSuggestion(p => ({ ...p, [vp.id]: d.text ?? d.result ?? d.content ?? 'No suggestion returned.' }));
    } catch {
      setAiSuggestion(p => ({ ...p, [vp.id]: 'AI service unavailable. Try again later.' }));
    } finally {
      setAiLoading(p => ({ ...p, [vp.id]: false }));
    }
  }

  const ARRAY_FIELDS = [
    { key: 'customer_jobs', label: 'Customer Jobs (comma-separated)', icon: '🎯' },
    { key: 'pains', label: 'Pains (comma-separated)', icon: '😣' },
    { key: 'gains', label: 'Gains (comma-separated)', icon: '😊' },
    { key: 'products_services', label: 'Products & Services (comma-separated)', icon: '📦' },
    { key: 'pain_relievers', label: 'Pain Relievers (comma-separated)', icon: '💊' },
    { key: 'gain_creators', label: 'Gain Creators (comma-separated)', icon: '✨' },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-purple-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className={GLASS}>
          <h1 className="text-3xl font-bold text-white">💡 Value Proposition Builder</h1>
          <p className="text-white/60 mt-1">Design, validate, and compare customer value propositions.</p>
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

        {/* Tab 0: Value Map Canvas */}
        {!loading && activeTab === 0 && (
          <div className={GLASS}>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-xl font-semibold text-white">Value Proposition Canvas</h2>
              <select
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                value={selectedId ?? ''}
                onChange={e => setSelectedId(Number(e.target.value) || null)}
              >
                {propositions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            {selected && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                {/* Customer Profile — Left */}
                <div className="space-y-4">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5">
                    <h3 className="text-blue-300 font-semibold mb-3 text-sm uppercase tracking-wide">🎯 Customer Jobs</h3>
                    <ul className="space-y-1">
                      {selected.customer_jobs.map((j, i) => (
                        <li key={i} className="text-white/80 text-sm flex items-start gap-2"><span className="text-blue-400 mt-0.5">▸</span>{j}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
                    <h3 className="text-red-300 font-semibold mb-3 text-sm uppercase tracking-wide">😣 Pains</h3>
                    <ul className="space-y-1">
                      {selected.pains.map((p, i) => (
                        <li key={i} className="text-white/80 text-sm flex items-start gap-2"><span className="text-red-400 mt-0.5">😣</span>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
                    <h3 className="text-green-300 font-semibold mb-3 text-sm uppercase tracking-wide">😊 Gains</h3>
                    <ul className="space-y-1">
                      {selected.gains.map((g, i) => (
                        <li key={i} className="text-white/80 text-sm flex items-start gap-2"><span className="text-green-400 mt-0.5">😊</span>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Fit Score — Center overlay */}
                <div className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
                  <div className={`border-2 rounded-2xl px-6 py-4 text-center pointer-events-none ${fitBg(selected.fit_score)}`}>
                    <p className="text-white/60 text-xs uppercase tracking-wide">FIT SCORE</p>
                    <p className={`text-5xl font-black ${fitColor(selected.fit_score)}`}>{selected.fit_score}</p>
                    <p className="text-white/50 text-xs">/100</p>
                  </div>
                </div>

                {/* Value Map — Right */}
                <div className="space-y-4">
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5">
                    <h3 className="text-purple-300 font-semibold mb-3 text-sm uppercase tracking-wide">📦 Products & Services</h3>
                    <ul className="space-y-1">
                      {selected.products_services.map((p, i) => (
                        <li key={i} className="text-white/80 text-sm flex items-start gap-2"><span className="text-purple-400 mt-0.5">📦</span>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5">
                    <h3 className="text-orange-300 font-semibold mb-3 text-sm uppercase tracking-wide">💊 Pain Relievers</h3>
                    <ul className="space-y-1">
                      {selected.pain_relievers.map((p, i) => (
                        <li key={i} className="text-white/80 text-sm flex items-start gap-2"><span className="text-orange-400 mt-0.5">💊</span>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-5">
                    <h3 className="text-teal-300 font-semibold mb-3 text-sm uppercase tracking-wide">✨ Gain Creators</h3>
                    <ul className="space-y-1">
                      {selected.gain_creators.map((g, i) => (
                        <li key={i} className="text-white/80 text-sm flex items-start gap-2"><span className="text-teal-400 mt-0.5">✨</span>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Mobile fit score */}
                <div className={`lg:hidden border-2 rounded-2xl px-6 py-4 text-center col-span-full ${fitBg(selected.fit_score)}`}>
                  <p className="text-white/60 text-xs uppercase tracking-wide">FIT SCORE</p>
                  <p className={`text-5xl font-black ${fitColor(selected.fit_score)}`}>{selected.fit_score}</p>
                  <p className="text-white/50 text-xs">/100</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: All Propositions */}
        {!loading && activeTab === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {propositions.map(vp => (
              <div key={vp.id} className={GLASS + ' space-y-3'}>
                <div className="flex justify-between items-start">
                  <h3 className="text-white font-semibold">{vp.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[vp.status]}`}>{vp.status}</span>
                </div>
                <p className="text-white/60 text-sm">{vp.segment}</p>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-black ${fitColor(vp.fit_score)}`}>{vp.fit_score}</span>
                  <span className="text-white/40 text-sm">/ 100 fit score</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-white/40">v{vp.version}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/40">{new Date(vp.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => { setSelectedId(vp.id); setActiveTab(0); }} className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-xs px-3 py-1 rounded-lg transition-colors">View Canvas</button>
                  <button onClick={() => editVP(vp)} className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1 rounded-lg transition-colors">Edit</button>
                  <button onClick={() => cloneVP(vp)} className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1 rounded-lg transition-colors">Clone</button>
                  <button onClick={() => archiveVP(vp)} className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 text-xs px-3 py-1 rounded-lg transition-colors">Archive</button>
                </div>
              </div>
            ))}
            <button onClick={() => { setForm(emptyForm); setActiveTab(2); }} className={GLASS + ' flex items-center justify-center text-white/40 hover:text-white/70 transition-colors border-dashed cursor-pointer'}>
              <span className="text-2xl">+</span>
              <span className="ml-2 text-sm">New Proposition</span>
            </button>
          </div>
        )}

        {/* Tab 2: Create / Edit */}
        {activeTab === 2 && (
          <div className={GLASS}>
            <h2 className="text-xl font-semibold text-white mb-6">{form.id ? 'Edit Value Proposition' : 'Create Value Proposition'}</h2>
            <form onSubmit={submitForm} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/70 text-sm block mb-1">Title *</label>
                  <input required className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Segment *</label>
                  <input required className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={form.segment} onChange={e => setForm(p => ({ ...p, segment: e.target.value }))} />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Status</label>
                  <select className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Channel</label>
                  <input className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))} placeholder="e.g. outbound_sales" />
                </div>
              </div>

              {/* Array fields */}
              {ARRAY_FIELDS.map(({ key, label, icon }) => (
                <div key={key}>
                  <label className="text-white/70 text-sm block mb-1">{icon} {label}</label>
                  <textarea
                    rows={2}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm resize-none"
                    value={(form as Record<string, string>)[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder="Item 1, Item 2, Item 3"
                  />
                  {/* Chips preview */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {parseTagInput((form as Record<string, string>)[key]).map((chip, i) => (
                      <span key={i} className="bg-white/10 text-white/70 text-xs px-2 py-0.5 rounded-full">{chip}</span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Fit Score Slider */}
              <div>
                <label className="text-white/70 text-sm block mb-1">Fit Score: <span className={`font-bold ${fitColor(Number(form.fit_score))}`}>{form.fit_score}</span></label>
                <input type="range" min="0" max="100" className="w-full accent-purple-500" value={form.fit_score} onChange={e => setForm(p => ({ ...p, fit_score: e.target.value }))} />
              </div>

              <div>
                <label className="text-white/70 text-sm block mb-1">Notes</label>
                <textarea rows={2} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm resize-none" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>

              <div className="flex gap-3">
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                  {form.id ? 'Save Changes' : 'Create'}
                </button>
                <button type="button" onClick={() => { setForm(emptyForm); setActiveTab(1); }} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Fit Analysis */}
        {!loading && activeTab === 3 && (
          <div className="space-y-4">
            {propositions.map(vp => {
              const painGaps = vp.pains.filter((_, i) => !vp.pain_relievers[i]);
              const gainGaps = vp.gains.filter((_, i) => !vp.gain_creators[i]);
              const relieversUsed = vp.pains.filter((_, i) => !!vp.pain_relievers[i]).length;
              const creatorsUsed = vp.gains.filter((_, i) => !!vp.gain_creators[i]).length;

              return (
                <div key={vp.id} className={GLASS + ' space-y-4'}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-white font-semibold">{vp.title}</h3>
                      <p className="text-white/50 text-sm">{vp.segment}</p>
                    </div>
                    <span className={`text-3xl font-black ${fitColor(vp.fit_score)}`}>{vp.fit_score}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-white/60 text-xs mb-1">Pain-Reliever Match</p>
                      <p className="text-white font-bold">{relieversUsed}/{vp.pains.length}</p>
                      <div className="h-1.5 bg-white/10 rounded-full mt-2">
                        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${vp.pains.length > 0 ? (relieversUsed/vp.pains.length)*100 : 0}%` }} />
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-white/60 text-xs mb-1">Gain-Creator Match</p>
                      <p className="text-white font-bold">{creatorsUsed}/{vp.gains.length}</p>
                      <div className="h-1.5 bg-white/10 rounded-full mt-2">
                        <div className="h-full bg-teal-400 rounded-full" style={{ width: `${vp.gains.length > 0 ? (creatorsUsed/vp.gains.length)*100 : 0}%` }} />
                      </div>
                    </div>
                  </div>

                  {(painGaps.length > 0 || gainGaps.length > 0) && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-2">
                      <p className="text-red-300 text-sm font-medium">Gaps Found</p>
                      {painGaps.length > 0 && <p className="text-white/60 text-xs">😣 Pains without relievers: {painGaps.join(' | ')}</p>}
                      {gainGaps.length > 0 && <p className="text-white/60 text-xs">😊 Gains without creators: {gainGaps.join(' | ')}</p>}
                    </div>
                  )}

                  {(painGaps.length > 0 || gainGaps.length > 0) && (
                    <button
                      onClick={() => askAI(vp)}
                      disabled={!!aiLoading[vp.id]}
                      className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {aiLoading[vp.id] ? 'Asking AI…' : '🤖 Ask AI for Suggestions'}
                    </button>
                  )}

                  {aiSuggestion[vp.id] && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                      <p className="text-purple-300 text-xs font-medium mb-1">AI Suggestion</p>
                      <p className="text-white/80 text-sm whitespace-pre-wrap">{aiSuggestion[vp.id]}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: Segment Comparison */}
        {!loading && activeTab === 4 && (
          <div className={GLASS}>
            <h2 className="text-xl font-semibold text-white mb-4">Segment Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 pr-4 text-white/50 w-32">Dimension</th>
                    {propositions.map(vp => (
                      <th key={vp.id} className="text-left py-3 px-4 text-white font-medium">
                        <div>{vp.title}</div>
                        <div className="text-white/50 font-normal text-xs">{vp.segment}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Customer Jobs', key: 'customer_jobs' as keyof ValueProposition, icon: '🎯' },
                    { label: 'Pains', key: 'pains' as keyof ValueProposition, icon: '😣' },
                    { label: 'Gains', key: 'gains' as keyof ValueProposition, icon: '😊' },
                    { label: 'Products', key: 'products_services' as keyof ValueProposition, icon: '📦' },
                  ].map(({ label, key, icon }) => {
                    // Find items shared across segments
                    const allItems = propositions.flatMap(vp => (vp[key] as string[]) || []);
                    const itemCounts: Record<string, number> = {};
                    allItems.forEach(item => { itemCounts[item] = (itemCounts[item] ?? 0) + 1; });

                    return (
                      <tr key={key} className="border-b border-white/5 align-top">
                        <td className="py-3 pr-4 text-white/50 font-medium">{icon} {label}</td>
                        {propositions.map(vp => (
                          <td key={vp.id} className="py-3 px-4">
                            <ul className="space-y-1">
                              {((vp[key] as string[]) || []).map((item, i) => (
                                <li
                                  key={i}
                                  className={`text-xs px-2 py-0.5 rounded ${itemCounts[item] > 1 ? 'bg-yellow-500/20 text-yellow-200' : 'text-white/70'}`}
                                  title={itemCounts[item] > 1 ? 'Shared across segments — opportunity for unified messaging' : ''}
                                >
                                  {itemCounts[item] > 1 && '⚡ '}{item}
                                </li>
                              ))}
                            </ul>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr className="border-b border-white/5">
                    <td className="py-3 pr-4 text-white/50 font-medium">📊 Fit Score</td>
                    {propositions.map(vp => (
                      <td key={vp.id} className="py-3 px-4">
                        <span className={`text-2xl font-bold ${fitColor(vp.fit_score)}`}>{vp.fit_score}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <p className="text-yellow-300/60 text-xs mt-3">⚡ Highlighted items appear in multiple segments — potential for unified messaging.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
