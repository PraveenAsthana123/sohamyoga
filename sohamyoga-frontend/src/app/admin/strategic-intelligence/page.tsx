'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StrategicAnalysis {
  id: number;
  analysis_type: string;
  title: string;
  subject: string | null;
  content: Record<string, unknown>;
  ai_insights: string | null;
  status: string;
  version: number;
  created_by: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ConsensusOption {
  id: string;
  label: string;
  description?: string;
}

interface ConsensusItem {
  id: number;
  title: string;
  description: string | null;
  decision_type: string;
  status: string;
  proposed_by: string | null;
  options: ConsensusOption[];
  votes: Record<string, string>;
  deadline: string | null;
  decided_option: string | null;
  decision_rationale: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const glass = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const glassCard = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-4 shadow-lg';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-all';
const tabActive = `${tabBase} bg-white/20 text-white`;
const tabInactive = `${tabBase} text-white/60 hover:bg-white/10 hover:text-white`;

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-500/30 text-gray-300',
    in_review: 'bg-yellow-500/30 text-yellow-300',
    finalized: 'bg-green-500/30 text-green-300',
    archived: 'bg-purple-500/30 text-purple-300',
    live: 'bg-green-500/30 text-green-300',
    in_progress: 'bg-yellow-500/30 text-yellow-300',
    planned: 'bg-blue-500/30 text-blue-300',
    open: 'bg-blue-500/30 text-blue-300',
    voting: 'bg-yellow-500/30 text-yellow-300',
    decided: 'bg-green-500/30 text-green-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[status] ?? 'bg-white/20 text-white'}`}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    P0: 'bg-red-500/40 text-red-200',
    P1: 'bg-orange-500/40 text-orange-200',
    P2: 'bg-yellow-500/40 text-yellow-200',
    P3: 'bg-gray-500/40 text-gray-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[priority] ?? 'bg-white/20 text-white'}`}>
      {priority}
    </span>
  );
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < rating ? 'text-yellow-400' : 'text-white/20'}>★</span>
      ))}
    </span>
  );
}

function AiInsightsCard({ insights, onClose }: { insights: string; onClose: () => void }) {
  return (
    <div className={`${glass} mt-4 border-blue-400/30`}>
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-blue-300 font-semibold flex items-center gap-2">
          <span>🤖</span> AI Insights
        </h4>
        <button onClick={onClose} className="text-white/40 hover:text-white text-sm">✕</button>
      </div>
      <p className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">{insights}</p>
    </div>
  );
}

// ─── Tab 1: AI Strategy ───────────────────────────────────────────────────────

function AiStrategyTab({ analyses, onAnalyze, onPatch }: {
  analyses: StrategicAnalysis[];
  onAnalyze: (id: number) => Promise<void>;
  onPatch: (id: number, data: Partial<StrategicAnalysis>) => Promise<void>;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const analysis = analyses.find(a => a.analysis_type === 'AI_STRATEGY');
  if (!analysis) return <div className={glass}><p className="text-white/60">No AI Strategy analysis found. Create one in the All Analyses tab.</p></div>;

  const c = analysis.content as {
    vision: string;
    principles: string[];
    initiatives: { name: string; status: string; priority: string }[];
    governance: { framework: string; review_cadence: string; responsible_team: string };
  };

  const principleIcons = ['🎯', '💡', '🧑‍💼', '📚', '🔒'];

  async function handleAnalyze() {
    setAnalyzing(true);
    await onAnalyze(analysis!.id);
    setAnalyzing(false);
  }

  async function handleSave() {
    try {
      const parsed = JSON.parse(editContent) as Record<string, unknown>;
      setSaving(true);
      await onPatch(analysis!.id, { content: parsed });
      setEditOpen(false);
    } catch {
      alert('Invalid JSON');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Vision */}
      <div className={`${glass} text-center`}>
        <div className="text-4xl mb-3">🚀</div>
        <p className="text-xs text-blue-300 uppercase tracking-widest mb-2">Strategic Vision</p>
        <h2 className="text-2xl font-bold text-white">{c.vision}</h2>
      </div>

      {/* Principles */}
      <div>
        <h3 className="text-white/80 font-semibold mb-3 text-lg">AI Principles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {c.principles?.map((p, i) => (
            <div key={i} className={glassCard}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{principleIcons[i] ?? '⚡'}</span>
                <div>
                  <span className="text-white/40 text-xs font-mono">0{i + 1}</span>
                  <p className="text-white text-sm mt-1">{p}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Initiatives */}
      <div className={glass}>
        <h3 className="text-white/80 font-semibold mb-4 text-lg">AI Initiatives</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 border-b border-white/10">
                <th className="text-left py-2 pr-4">Initiative</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2">Priority</th>
              </tr>
            </thead>
            <tbody>
              {c.initiatives?.map((ini, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 pr-4 text-white font-medium">{ini.name}</td>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2">
                      <span>{ini.status === 'live' ? '🟢' : ini.status === 'in_progress' ? '🟡' : '⬜'}</span>
                      <StatusBadge status={ini.status} />
                    </span>
                  </td>
                  <td className="py-3"><PriorityBadge priority={ini.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Governance */}
      <div className={glassCard}>
        <h3 className="text-white/80 font-semibold mb-3">Governance</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-white/40 text-xs mb-1">Framework</p>
            <p className="text-white font-bold">{c.governance?.framework}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Review Cadence</p>
            <p className="text-white font-bold capitalize">{c.governance?.review_cadence}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Responsible Team</p>
            <p className="text-white font-bold">{c.governance?.responsible_team}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-4 py-2 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-medium transition-all disabled:opacity-50"
        >
          {analyzing ? '⏳ Analyzing...' : '🤖 Generate AI Insights'}
        </button>
        <button
          onClick={() => { setEditContent(JSON.stringify(analysis.content, null, 2)); setEditOpen(true); }}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
        >
          ✏️ Edit
        </button>
      </div>

      {analysis.ai_insights && <AiInsightsCard insights={analysis.ai_insights} onClose={() => {}} />}

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${glass} w-full max-w-2xl`}>
            <h3 className="text-white font-semibold mb-3">Edit AI Strategy Content (JSON)</h3>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full h-64 bg-black/40 text-green-300 font-mono text-sm p-3 rounded-lg border border-white/20 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-500/40 text-blue-200 rounded-lg text-sm hover:bg-blue-500/60 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: SWOT Analysis ─────────────────────────────────────────────────────

function SwotTab({ analyses, onAnalyze, onAdd }: {
  analyses: StrategicAnalysis[];
  onAnalyze: (id: number) => Promise<void>;
  onAdd: (data: Partial<StrategicAnalysis>) => Promise<void>;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [opportunities, setOpportunities] = useState('');
  const [threats, setThreats] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [saving, setSaving] = useState(false);

  const swots = analyses.filter(a => a.analysis_type === 'SWOT');
  const analysis = selectedId ? swots.find(s => s.id === selectedId) : swots[0];

  const c = (analysis?.content ?? {}) as {
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    threats?: string[];
  };

  async function handleAnalyze() {
    if (!analysis) return;
    setAnalyzing(true);
    await onAnalyze(analysis.id);
    setAnalyzing(false);
  }

  async function handleCreate() {
    if (!newTitle) return;
    setSaving(true);
    await onAdd({
      analysis_type: 'SWOT',
      title: newTitle,
      subject: newSubject,
      content: {
        strengths: strengths.split('\n').filter(Boolean),
        weaknesses: weaknesses.split('\n').filter(Boolean),
        opportunities: opportunities.split('\n').filter(Boolean),
        threats: threats.split('\n').filter(Boolean),
      },
    });
    setShowCreate(false);
    setSaving(false);
  }

  const quadrants = [
    { key: 'strengths', label: 'STRENGTHS', icon: '💪', bg: 'bg-green-900/40 border-green-500/30', items: c.strengths },
    { key: 'weaknesses', label: 'WEAKNESSES', icon: '⚠️', bg: 'bg-red-900/40 border-red-500/30', items: c.weaknesses },
    { key: 'opportunities', label: 'OPPORTUNITIES', icon: '🚀', bg: 'bg-blue-900/40 border-blue-500/30', items: c.opportunities },
    { key: 'threats', label: 'THREATS', icon: '☠️', bg: 'bg-amber-900/40 border-amber-500/30', items: c.threats },
  ];

  return (
    <div className="space-y-6">
      {/* Selector */}
      {swots.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {swots.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm ${analysis?.id === s.id ? 'bg-white/20 text-white' : 'text-white/60 bg-white/5 hover:bg-white/10'}`}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {analysis && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-white font-semibold text-lg">{analysis.title}</h3>
            <div className="flex gap-2">
              <StatusBadge status={analysis.status} />
              <span className="text-white/40 text-sm">v{analysis.version}</span>
            </div>
          </div>
          {/* 2×2 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quadrants.map(q => (
              <div key={q.key} className={`backdrop-blur-md border rounded-2xl p-5 shadow-xl ${q.bg}`}>
                <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                  <span className="text-xl">{q.icon}</span> {q.label}
                </h4>
                <ul className="space-y-2">
                  {(q.items ?? []).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/80 text-sm">
                      <span className="text-white/40 mt-0.5">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-4 py-2 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-medium transition-all disabled:opacity-50"
            >
              {analyzing ? '⏳ Analyzing...' : '🤖 Generate AI Insights'}
            </button>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium">
              ➕ Create New SWOT
            </button>
          </div>
          {analysis.ai_insights && <AiInsightsCard insights={analysis.ai_insights} onClose={() => {}} />}
        </>
      )}

      {!analysis && (
        <div className={glass}>
          <p className="text-white/60">No SWOT analyses yet.</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 px-4 py-2 rounded-lg bg-blue-500/30 text-blue-200 text-sm">➕ Create SWOT</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${glass} w-full max-w-2xl my-8`}>
            <h3 className="text-white font-semibold mb-4">Create New SWOT Analysis</h3>
            <div className="space-y-3">
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm" />
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Subject (what is being analyzed)" className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm" />
              {[['Strengths', strengths, setStrengths], ['Weaknesses', weaknesses, setWeaknesses], ['Opportunities', opportunities, setOpportunities], ['Threats', threats, setThreats]].map(([label, val, setter]) => (
                <div key={label as string}>
                  <label className="text-white/60 text-xs mb-1 block">{label as string} (one per line)</label>
                  <textarea value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm h-20 resize-none" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-blue-500/40 text-blue-200 rounded-lg text-sm hover:bg-blue-500/60 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: PESTEL Analysis ───────────────────────────────────────────────────

function PestelTab({ analyses, onAnalyze, onAdd }: {
  analyses: StrategicAnalysis[];
  onAnalyze: (id: number) => Promise<void>;
  onAdd: (data: Partial<StrategicAnalysis>) => Promise<void>;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [saving, setSaving] = useState(false);

  const pestels = analyses.filter(a => a.analysis_type === 'PESTEL');
  const analysis = pestels[0];

  const categories = [
    { key: 'political', label: 'Political', icon: '🏛️', color: 'border-red-500/40 bg-red-900/20' },
    { key: 'economic', label: 'Economic', icon: '💰', color: 'border-green-500/40 bg-green-900/20' },
    { key: 'social', label: 'Social', icon: '👥', color: 'border-blue-500/40 bg-blue-900/20' },
    { key: 'technological', label: 'Technological', icon: '⚡', color: 'border-purple-500/40 bg-purple-900/20' },
    { key: 'environmental', label: 'Environmental', icon: '🌱', color: 'border-emerald-500/40 bg-emerald-900/20' },
    { key: 'legal', label: 'Legal', icon: '⚖️', color: 'border-amber-500/40 bg-amber-900/20' },
  ];

  const c = (analysis?.content ?? {}) as Record<string, string[]>;

  async function handleCreate() {
    setSaving(true);
    await onAdd({ analysis_type: 'PESTEL', title: newTitle, subject: newSubject, content: {} });
    setShowCreate(false);
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {analysis && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-white font-semibold text-lg">{analysis.title}</h3>
            <StatusBadge status={analysis.status} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => (
              <div key={cat.key} className={`backdrop-blur-md border rounded-2xl p-5 shadow-xl ${cat.color}`}>
                <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                  <span className="text-xl">{cat.icon}</span> {cat.label}
                </h4>
                <ul className="space-y-1.5">
                  {(c[cat.key] ?? []).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/80 text-sm">
                      <span className="text-white/40">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => { setAnalyzing(true); await onAnalyze(analysis.id); setAnalyzing(false); }}
              disabled={analyzing}
              className="px-4 py-2 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-medium disabled:opacity-50"
            >
              {analyzing ? '⏳ Analyzing...' : '🤖 Generate AI Insights'}
            </button>
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">➕ Create New PESTEL</button>
          </div>
          {analysis.ai_insights && <AiInsightsCard insights={analysis.ai_insights} onClose={() => {}} />}
        </>
      )}
      {!analysis && (
        <div className={glass}>
          <p className="text-white/60 mb-3">No PESTEL analyses yet.</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-blue-500/30 text-blue-200 text-sm">➕ Create PESTEL</button>
        </div>
      )}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${glass} w-full max-w-lg`}>
            <h3 className="text-white font-semibold mb-4">Create New PESTEL Analysis</h3>
            <div className="space-y-3">
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm" />
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Subject" className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-blue-500/40 text-blue-200 rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Porter's Five Forces ──────────────────────────────────────────────

function PorterTab({ analyses, onAnalyze }: {
  analyses: StrategicAnalysis[];
  onAnalyze: (id: number) => Promise<void>;
}) {
  const [analyzing, setAnalyzing] = useState(false);

  const analysis = analyses.find(a => a.analysis_type === 'PORTER');
  if (!analysis) return <div className={glass}><p className="text-white/60">No Porter analysis found. Create one in the All Analyses tab.</p></div>;

  const c = analysis.content as {
    competitive_rivalry: { intensity: string; factors: string[]; rating: number };
    supplier_power: { intensity: string; factors: string[]; rating: number };
    buyer_power: { intensity: string; factors: string[]; rating: number };
    threat_of_substitutes: { intensity: string; factors: string[]; rating: number };
    threat_of_new_entrants: { intensity: string; factors: string[]; rating: number };
  };

  const intensityColor = (i: string) => i === 'high' ? 'text-red-400' : i === 'medium' ? 'text-yellow-400' : 'text-green-400';

  function ForceBox({ label, data, className }: { label: string; data: { intensity: string; factors: string[]; rating: number }; className?: string }) {
    return (
      <div className={`backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-4 shadow-lg ${className ?? ''}`}>
        <h5 className="text-white/80 font-semibold text-sm mb-2">{label}</h5>
        <span className={`text-xs font-bold uppercase ${intensityColor(data.intensity)}`}>{data.intensity}</span>
        <div className="my-1"><StarRating rating={data.rating} /></div>
        <ul className="mt-2 space-y-1">
          {data.factors.map((f, i) => (
            <li key={i} className="text-white/60 text-xs flex items-start gap-1"><span>•</span>{f}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-semibold text-lg">{analysis.title}</h3>
        <StatusBadge status={analysis.status} />
      </div>

      {/* Porter Diagram */}
      <div className="flex flex-col items-center gap-4">
        {/* Top */}
        <ForceBox label="🆕 Threat of New Entrants" data={c.threat_of_new_entrants} className="w-full max-w-xs" />
        {/* Middle Row */}
        <div className="flex flex-col md:flex-row items-center gap-4 w-full justify-center">
          <ForceBox label="🏭 Supplier Power" data={c.supplier_power} className="w-full max-w-xs" />
          {/* Center */}
          <div className="backdrop-blur-md bg-gradient-to-br from-blue-600/30 to-purple-600/30 border-2 border-blue-400/40 rounded-2xl p-6 shadow-2xl text-center w-full max-w-xs">
            <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Industry</p>
            <h4 className="text-white font-bold text-lg">COMPETITIVE</h4>
            <h4 className="text-white font-bold text-lg">RIVALRY</h4>
            <div className="mt-2">
              <span className={`text-sm font-bold uppercase ${intensityColor(c.competitive_rivalry?.intensity)}`}>{c.competitive_rivalry?.intensity}</span>
            </div>
            <div className="mt-1"><StarRating rating={c.competitive_rivalry?.rating} /></div>
          </div>
          <ForceBox label="🛒 Buyer Power" data={c.buyer_power} className="w-full max-w-xs" />
        </div>
        {/* Bottom */}
        <ForceBox label="🔄 Threat of Substitutes" data={c.threat_of_substitutes} className="w-full max-w-xs" />
      </div>

      <div className="flex gap-3">
        <button
          onClick={async () => { setAnalyzing(true); await onAnalyze(analysis.id); setAnalyzing(false); }}
          disabled={analyzing}
          className="px-4 py-2 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-medium disabled:opacity-50"
        >
          {analyzing ? '⏳ Analyzing...' : '🤖 Generate AI Insights'}
        </button>
      </div>
      {analysis.ai_insights && <AiInsightsCard insights={analysis.ai_insights} onClose={() => {}} />}
    </div>
  );
}

// ─── Tab 5: First Principles ──────────────────────────────────────────────────

function FirstPrinciplesTab({ analyses, onAnalyze, onAdd }: {
  analyses: StrategicAnalysis[];
  onAnalyze: (id: number) => Promise<void>;
  onAdd: (data: Partial<StrategicAnalysis>) => Promise<void>;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [problem, setProblem] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const analysis = analyses.find(a => a.analysis_type === 'FIRST_PRINCIPLES');

  const c = (analysis?.content ?? {}) as {
    problem?: string;
    assumptions_broken?: string[];
    first_principles?: string[];
    derived_solutions?: string[];
  };

  async function handleDecompose() {
    if (!problem.trim()) return;
    setSubmitting(true);
    const newAnalysis = await onAdd({
      analysis_type: 'FIRST_PRINCIPLES',
      title: `First Principles: ${problem.slice(0, 50)}`,
      subject: problem,
      content: { problem },
    });
    void newAnalysis;
    setSubmitting(false);
    setProblem('');
  }

  return (
    <div className="space-y-6">
      {analysis && (
        <>
          {/* Problem */}
          <div className={`${glass} border-orange-500/30`}>
            <p className="text-orange-300 text-xs uppercase tracking-widest mb-2">Problem Statement</p>
            <p className="text-white text-lg font-semibold">{c.problem}</p>
          </div>

          {/* Assumptions Broken */}
          <div>
            <h3 className="text-white/80 font-semibold mb-3">❌ Assumptions Broken</h3>
            <div className="space-y-3">
              {c.assumptions_broken?.map((a, i) => (
                <div key={i} className={`${glassCard} border-red-500/20`}>
                  <div className="flex items-start gap-3">
                    <span className="text-red-400 text-xl">❌</span>
                    <div>
                      <span className="text-white/40 text-xs font-mono">ASSUMPTION {i + 1}</span>
                      <p className="text-white text-sm mt-1">{a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* First Principles */}
          <div>
            <h3 className="text-white/80 font-semibold mb-3">🔬 First Principles</h3>
            <div className="space-y-3">
              {c.first_principles?.map((p, i) => (
                <div key={i} className={`${glassCard} border-blue-500/20`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🔬</span>
                    <p className="text-white text-sm">{p}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Derived Solutions */}
          <div>
            <h3 className="text-white/80 font-semibold mb-3">💡 Derived Solutions</h3>
            <div className="space-y-3">
              {c.derived_solutions?.map((s, i) => (
                <div key={i} className={`${glassCard} border-green-500/20`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <p className="text-white text-sm">{s}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={async () => { setAnalyzing(true); await onAnalyze(analysis.id); setAnalyzing(false); }}
            disabled={analyzing}
            className="px-4 py-2 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-medium disabled:opacity-50"
          >
            {analyzing ? '⏳ Analyzing...' : '🤖 Generate AI Insights'}
          </button>
          {analysis.ai_insights && <AiInsightsCard insights={analysis.ai_insights} onClose={() => {}} />}
        </>
      )}

      {/* Apply to new problem */}
      <div className={glass}>
        <h3 className="text-white font-semibold mb-3">🔬 Apply First Principles to New Problem</h3>
        <textarea
          value={problem}
          onChange={e => setProblem(e.target.value)}
          placeholder="Describe the problem you want to decompose using first principles..."
          className="w-full bg-black/40 text-white p-3 rounded-lg border border-white/20 text-sm h-24 resize-none"
        />
        <button
          onClick={handleDecompose}
          disabled={submitting || !problem.trim()}
          className="mt-3 px-4 py-2 rounded-lg bg-orange-500/30 hover:bg-orange-500/50 text-orange-200 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? '⏳ Creating...' : '🔬 Decompose Problem'}
        </button>
      </div>
    </div>
  );
}

// ─── Tab 6: All Analyses ──────────────────────────────────────────────────────

function AllAnalysesTab({ analyses, onAdd, onTabSwitch }: {
  analyses: StrategicAnalysis[];
  onAdd: (data: Partial<StrategicAnalysis>) => Promise<void>;
  onTabSwitch: (tab: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('SWOT');
  const [newSubject, setNewSubject] = useState('');
  const [saving, setSaving] = useState(false);

  const types = ['SWOT', 'PESTEL', 'PORTER', 'AI_STRATEGY', 'FIRST_PRINCIPLES', 'CONSENSUS'];
  const typeTabMap: Record<string, string> = {
    AI_STRATEGY: 'AI Strategy',
    SWOT: 'SWOT',
    PESTEL: 'PESTEL',
    PORTER: "Porter's",
    FIRST_PRINCIPLES: 'First Principles',
  };

  const filtered = filter ? analyses.filter(a => a.analysis_type === filter) : analyses;

  async function handleCreate() {
    setSaving(true);
    await onAdd({ analysis_type: newType, title: newTitle, subject: newSubject, content: {} });
    setShowCreate(false);
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('')} className={filter === '' ? tabActive : tabInactive}>All</button>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} className={filter === t ? tabActive : tabInactive}>{t}</button>
        ))}
        <button onClick={() => setShowCreate(true)} className="ml-auto px-4 py-2 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-medium">
          ➕ New Analysis
        </button>
      </div>

      <div className={glass}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 border-b border-white/10">
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Title</th>
                <th className="text-left py-2 pr-4">Subject</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2 pr-4">Version</th>
                <th className="text-left py-2 pr-4">AI</th>
                <th className="text-left py-2">Created</th>
                <th className="text-left py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 pr-4">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white/80 text-xs font-mono">{a.analysis_type}</span>
                  </td>
                  <td className="py-3 pr-4 text-white font-medium max-w-xs truncate">{a.title}</td>
                  <td className="py-3 pr-4 text-white/60 max-w-xs truncate">{a.subject ?? '—'}</td>
                  <td className="py-3 pr-4"><StatusBadge status={a.status} /></td>
                  <td className="py-3 pr-4 text-white/60">v{a.version}</td>
                  <td className="py-3 pr-4 text-center">{a.ai_insights ? '💬' : '—'}</td>
                  <td className="py-3 pr-4 text-white/40 text-xs">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="py-3">
                    {typeTabMap[a.analysis_type] && (
                      <button
                        onClick={() => onTabSwitch(typeTabMap[a.analysis_type])}
                        className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs hover:bg-blue-500/40"
                      >
                        View →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-white/40">No analyses found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${glass} w-full max-w-lg`}>
            <h3 className="text-white font-semibold mb-4">New Analysis</h3>
            <div className="space-y-3">
              <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm">
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm" />
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Subject (optional)" className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleCreate} disabled={saving || !newTitle} className="px-4 py-2 bg-blue-500/40 text-blue-200 rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 7: Consensus Management ─────────────────────────────────────────────

function ConsensusTab({ items, onRefresh }: { items: ConsensusItem[]; onRefresh: () => void }) {
  const [voterName, setVoterName] = useState('');
  const [votes, setVotes] = useState<Record<number, string>>({});
  const [deciding, setDeciding] = useState<number | null>(null);
  const [decidedOption, setDecidedOption] = useState('');
  const [rationale, setRationale] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', decision_type: 'feature', proposed_by: '', deadline: '' });
  const [optionRows, setOptionRows] = useState([{ id: 'a', label: '', description: '' }]);

  const openItems = items.filter(i => ['open', 'voting'].includes(i.status));
  const decidedItems = items.filter(i => i.status === 'decided');

  function getVoteCounts(item: ConsensusItem) {
    const counts: Record<string, number> = {};
    for (const optId of Object.values(item.votes)) {
      counts[optId] = (counts[optId] ?? 0) + 1;
    }
    return counts;
  }

  async function castVote(itemId: number) {
    const optionId = votes[itemId];
    if (!voterName || !optionId) { alert('Enter your name and select an option'); return; }
    await fetch('/api/admin/consensus/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, voter_name: voterName, option_id: optionId }),
    });
    onRefresh();
  }

  async function decide(itemId: number) {
    await fetch('/api/admin/consensus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, status: 'decided', decided_option: decidedOption, decision_rationale: rationale }),
    });
    setDeciding(null);
    onRefresh();
  }

  async function createItem() {
    setSaving(true);
    await fetch('/api/admin/consensus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newItem,
        options: optionRows.filter(o => o.label),
        deadline: newItem.deadline || null,
      }),
    });
    setShowCreate(false);
    setSaving(false);
    onRefresh();
  }

  return (
    <div className="space-y-6">
      {/* Voter name */}
      <div className={glassCard}>
        <label className="text-white/60 text-xs mb-1 block">Your Name (for voting)</label>
        <input
          value={voterName}
          onChange={e => setVoterName(e.target.value)}
          placeholder="Enter your name to cast votes"
          className="w-full max-w-xs bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm"
        />
      </div>

      {/* Open Items */}
      <div>
        <h3 className="text-white font-semibold text-lg mb-3">Open Decisions ({openItems.length})</h3>
        <div className="space-y-4">
          {openItems.map(item => {
            const counts = getVoteCounts(item);
            const totalVotes = Object.values(item.votes).length;
            const deadline = item.deadline ? new Date(item.deadline) : null;
            const daysLeft = deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86400000) : null;
            return (
              <div key={item.id} className={glass}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-white font-semibold">{item.title}</h4>
                    {item.description && <p className="text-white/60 text-sm mt-1">{item.description}</p>}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <StatusBadge status={item.status} />
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs">{item.decision_type}</span>
                      {item.proposed_by && <span className="text-white/40 text-xs">by {item.proposed_by}</span>}
                      {daysLeft !== null && <span className={`text-xs px-2 py-0.5 rounded-full ${daysLeft < 0 ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white/60'}`}>{daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}</span>}
                    </div>
                  </div>
                  <div className="text-white/40 text-sm">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</div>
                </div>
                {/* Options */}
                <div className="space-y-2 mb-4">
                  {item.options.map(opt => {
                    const voteCount = counts[opt.id] ?? 0;
                    const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                    return (
                      <div key={opt.id} className="flex items-center gap-3">
                        <input
                          type="radio"
                          name={`vote-${item.id}`}
                          value={opt.id}
                          checked={votes[item.id] === opt.id}
                          onChange={() => setVotes(v => ({ ...v, [item.id]: opt.id }))}
                          className="accent-blue-400"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-white">{opt.label}</span>
                            <span className="text-white/40">{voteCount} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full mt-1">
                            <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => castVote(item.id)} className="px-3 py-1.5 bg-blue-500/30 text-blue-200 rounded-lg text-sm hover:bg-blue-500/50">🗳️ Cast Vote</button>
                  <button onClick={() => setDeciding(item.id)} className="px-3 py-1.5 bg-green-500/30 text-green-200 rounded-lg text-sm hover:bg-green-500/50">✅ Decide</button>
                </div>
                {deciding === item.id && (
                  <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                    <select value={decidedOption} onChange={e => setDecidedOption(e.target.value)} className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm">
                      <option value="">Select winning option...</option>
                      {item.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <textarea value={rationale} onChange={e => setRationale(e.target.value)} placeholder="Decision rationale..." className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm h-20 resize-none" />
                    <div className="flex gap-3">
                      <button onClick={() => decide(item.id)} className="px-3 py-1.5 bg-green-500/40 text-green-200 rounded-lg text-sm">Confirm Decision</button>
                      <button onClick={() => setDeciding(null)} className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {openItems.length === 0 && <div className={glassCard}><p className="text-white/60">No open decisions.</p></div>}
        </div>
      </div>

      {/* Decided */}
      {decidedItems.length > 0 && (
        <div>
          <h3 className="text-white font-semibold text-lg mb-3">Decided ({decidedItems.length})</h3>
          <div className={glass}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/50 border-b border-white/10">
                  <th className="text-left py-2 pr-4">Title</th>
                  <th className="text-left py-2 pr-4">Decision</th>
                  <th className="text-left py-2">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {decidedItems.map(i => {
                  const decidedOpt = i.options.find(o => o.id === i.decided_option);
                  return (
                    <tr key={i.id} className="border-b border-white/5">
                      <td className="py-3 pr-4 text-white">{i.title}</td>
                      <td className="py-3 pr-4 text-green-300">{decidedOpt?.label ?? i.decided_option ?? '—'}</td>
                      <td className="py-3 text-white/60">{i.decision_rationale ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create */}
      <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 text-sm font-medium">
        ➕ Create Decision Item
      </button>

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${glass} w-full max-w-2xl my-8`}>
            <h3 className="text-white font-semibold mb-4">Create Decision Item</h3>
            <div className="space-y-3">
              <input value={newItem.title} onChange={e => setNewItem(n => ({ ...n, title: e.target.value }))} placeholder="Title" className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm" />
              <textarea value={newItem.description} onChange={e => setNewItem(n => ({ ...n, description: e.target.value }))} placeholder="Description" className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm h-20 resize-none" />
              <select value={newItem.decision_type} onChange={e => setNewItem(n => ({ ...n, decision_type: e.target.value }))} className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm">
                {['feature', 'strategy', 'process', 'policy', 'hiring', 'budget'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={newItem.proposed_by} onChange={e => setNewItem(n => ({ ...n, proposed_by: e.target.value }))} placeholder="Proposed by" className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm" />
              <input type="date" value={newItem.deadline} onChange={e => setNewItem(n => ({ ...n, deadline: e.target.value }))} className="w-full bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm" />
              <div>
                <p className="text-white/60 text-xs mb-2">Options (up to 5)</p>
                {optionRows.map((opt, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input value={opt.label} onChange={e => setOptionRows(rows => rows.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} placeholder={`Option ${i + 1} label`} className="flex-1 bg-black/40 text-white p-2 rounded-lg border border-white/20 text-sm" />
                  </div>
                ))}
                {optionRows.length < 5 && (
                  <button onClick={() => setOptionRows(r => [...r, { id: String.fromCharCode(97 + r.length), label: '', description: '' }])} className="text-blue-300 text-xs hover:text-blue-200">+ Add option</button>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={createItem} disabled={saving || !newItem.title} className="px-4 py-2 bg-blue-500/40 text-blue-200 rounded-lg text-sm disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 8: Strategy Library ──────────────────────────────────────────────────

const FRAMEWORKS = [
  { name: 'SWOT Analysis', icon: '🔲', when: 'Assess internal/external factors before major decisions', questions: ['What are our core strengths?', 'Where are we exposed?', 'What opportunities can we capture?'], type: 'SWOT' },
  { name: 'PESTEL Analysis', icon: '🌍', when: 'Understand macro-environment for strategic planning', questions: ['What political forces affect us?', 'How is the economic landscape shifting?', 'What technology trends matter?'], type: 'PESTEL' },
  { name: "Porter's Five Forces", icon: '⚔️', when: 'Evaluate industry attractiveness and competitive dynamics', questions: ['How intense is rivalry?', 'What is supplier/buyer leverage?', 'Are new entrants a threat?'], type: 'PORTER' },
  { name: 'First Principles', icon: '🔬', when: 'Challenge assumptions and redesign from scratch', questions: ['What do we assume but could be wrong?', 'What is true at the most fundamental level?', 'What would we build if starting fresh?'], type: 'FIRST_PRINCIPLES' },
  { name: 'Blue Ocean Strategy', icon: '🌊', when: 'Find uncontested market space by making competition irrelevant', questions: ['What can we eliminate?', 'What can we create that no one else offers?', 'Which factors can we raise or reduce?'], type: null },
  { name: 'Business Model Canvas', icon: '🗺️', when: 'Design or audit business model holistically', questions: ['Who are our key partners?', 'What are our cost structures?', 'What value do we deliver?'], type: null },
  { name: 'McKinsey 7S', icon: '🔗', when: 'Align organizational elements during transformation', questions: ['Are strategy, structure, and systems aligned?', 'Do shared values match our culture?', 'Is staff capability sufficient?'], type: null },
  { name: 'Ansoff Matrix', icon: '📈', when: 'Choose growth strategy across markets and products', questions: ['Should we penetrate existing markets?', 'Develop new products?', 'Diversify?'], type: null },
  { name: 'BCG Matrix', icon: '💠', when: 'Portfolio analysis for resource allocation', questions: ['Which products are Stars/Cash Cows/Dogs/Question Marks?', 'Where to invest vs. divest?'], type: null },
  { name: 'Value Chain Analysis', icon: '⛓️', when: 'Identify competitive advantage in operations', questions: ['Where do we add unique value?', 'Which activities can be optimized?', 'Where are our cost disadvantages?'], type: null },
  { name: 'Jobs-to-be-Done', icon: '🎯', when: 'Understand customer motivations deeply', questions: ['What job does the customer hire our product for?', 'What outcomes do they want?', 'What are their pains and gains?'], type: null },
  { name: 'OKRs', icon: '🏆', when: 'Set and track ambitious goals with measurable results', questions: ['What is the inspiring objective?', 'What 3-5 key results prove success?', 'How will we measure progress?'], type: null },
  { name: 'Balanced Scorecard', icon: '⚖️', when: 'Monitor strategy execution across four perspectives', questions: ['Financial performance?', 'Customer satisfaction?', 'Internal process efficiency?', 'Learning and growth?'], type: null },
  { name: 'VRIO Framework', icon: '💎', when: 'Identify sustainable competitive advantages', questions: ['Is the resource Valuable, Rare, Inimitable, Organized?', 'Can competitors copy it?'], type: null },
];

function StrategyLibraryTab({ onTabSwitch }: { onTabSwitch: (tab: string) => void }) {
  const typeTabMap: Record<string, string> = {
    AI_STRATEGY: 'AI Strategy',
    SWOT: 'SWOT',
    PESTEL: 'PESTEL',
    PORTER: "Porter's",
    FIRST_PRINCIPLES: 'First Principles',
  };

  return (
    <div className="space-y-4">
      <div className={glassCard}>
        <p className="text-white/60 text-sm">Strategic frameworks catalog. Click &quot;Use Framework&quot; to navigate to the relevant analysis tab.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FRAMEWORKS.map(fw => (
          <div key={fw.name} className={glass}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{fw.icon}</span>
                <h4 className="text-white font-semibold">{fw.name}</h4>
              </div>
              {fw.type && typeTabMap[fw.type] && (
                <button
                  onClick={() => onTabSwitch(typeTabMap[fw.type!])}
                  className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs hover:bg-blue-500/40"
                >
                  Use →
                </button>
              )}
            </div>
            <p className="text-white/50 text-xs mb-2 italic">When to use: {fw.when}</p>
            <ul className="space-y-1">
              {fw.questions.map((q, i) => (
                <li key={i} className="text-white/70 text-xs flex items-start gap-1.5">
                  <span className="text-blue-400 mt-0.5">?</span> {q}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = ['AI Strategy', 'SWOT', 'PESTEL', "Porter's", 'First Principles', 'All Analyses', 'Consensus', 'Library'] as const;
type Tab = typeof TABS[number];

export default function StrategicIntelligencePage() {
  const [activeTab, setActiveTab] = useState<Tab>('AI Strategy');
  const [analyses, setAnalyses] = useState<StrategicAnalysis[]>([]);
  const [consensusItems, setConsensusItems] = useState<ConsensusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyses = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/strategic-intelligence');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { analyses: StrategicAnalysis[] };
      setAnalyses(data.analyses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analyses');
    }
  }, []);

  const fetchConsensus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/consensus');
      if (!res.ok) return;
      const data = await res.json() as { items: ConsensusItem[] };
      setConsensusItems(data.items ?? []);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await Promise.all([fetchAnalyses(), fetchConsensus()]);
      setLoading(false);
    })();
  }, [fetchAnalyses, fetchConsensus]);

  const handleAnalyze = useCallback(async (id: number): Promise<void> => {
    const res = await fetch('/api/admin/strategic-intelligence/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      const data = await res.json() as { analysis: StrategicAnalysis };
      setAnalyses(prev => prev.map(a => a.id === id ? data.analysis : a));
    }
  }, []);

  const handleAdd = useCallback(async (data: Partial<StrategicAnalysis>): Promise<void> => {
    const res = await fetch('/api/admin/strategic-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const body = await res.json() as { analysis: StrategicAnalysis };
      setAnalyses(prev => [body.analysis, ...prev]);
    }
  }, []);

  const handlePatch = useCallback(async (id: number, data: Partial<StrategicAnalysis>): Promise<void> => {
    const res = await fetch('/api/admin/strategic-intelligence', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
    if (res.ok) {
      const body = await res.json() as { analysis: StrategicAnalysis };
      setAnalyses(prev => prev.map(a => a.id === id ? body.analysis : a));
    }
  }, []);

  const handleTabSwitch = useCallback((tab: string) => {
    if (TABS.includes(tab as Tab)) setActiveTab(tab as Tab);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">🧭</span>
          <div>
            <h1 className="text-3xl font-bold text-white">Strategic Intelligence</h1>
            <p className="text-white/50 text-sm">AI Strategy · SWOT · PESTEL · Porter&apos;s Five Forces · First Principles · Consensus</p>
          </div>
        </div>
        <div className="flex gap-3 mt-3 text-xs text-white/40">
          <span>{analyses.length} analyses</span>
          <span>·</span>
          <span>{consensusItems.length} decisions</span>
          <span>·</span>
          <span>{analyses.filter(a => a.ai_insights).length} AI-augmented</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-900/30 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? tabActive : tabInactive}>
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className={glass}>
          <div className="flex items-center gap-3 justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-white/60">Loading analyses...</span>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'AI Strategy' && <AiStrategyTab analyses={analyses} onAnalyze={handleAnalyze} onPatch={handlePatch} />}
          {activeTab === 'SWOT' && <SwotTab analyses={analyses} onAnalyze={handleAnalyze} onAdd={handleAdd} />}
          {activeTab === 'PESTEL' && <PestelTab analyses={analyses} onAnalyze={handleAnalyze} onAdd={handleAdd} />}
          {activeTab === "Porter's" && <PorterTab analyses={analyses} onAnalyze={handleAnalyze} />}
          {activeTab === 'First Principles' && <FirstPrinciplesTab analyses={analyses} onAnalyze={handleAnalyze} onAdd={handleAdd} />}
          {activeTab === 'All Analyses' && <AllAnalysesTab analyses={analyses} onAdd={handleAdd} onTabSwitch={handleTabSwitch} />}
          {activeTab === 'Consensus' && <ConsensusTab items={consensusItems} onRefresh={fetchConsensus} />}
          {activeTab === 'Library' && <StrategyLibraryTab onTabSwitch={handleTabSwitch} />}
        </>
      )}
    </div>
  );
}
