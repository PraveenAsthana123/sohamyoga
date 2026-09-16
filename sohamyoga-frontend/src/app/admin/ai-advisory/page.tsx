'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'Innovation Lab' | 'PoC / MVP Tracker' | 'Board Briefings' | 'Training & Enablement' | 'Advisory Dashboard';
const TABS: Tab[] = ['Innovation Lab', 'PoC / MVP Tracker', 'Board Briefings', 'Training & Enablement', 'Advisory Dashboard'];

interface Poc {
  id: number;
  name: string;
  use_case: string;
  hypothesis: string;
  success_criteria: string;
  tech_stack: string[];
  status: string;
  findings: string | null;
  recommendation: string | null;
  duration_weeks: number;
}

interface Briefing {
  id: number;
  title: string;
  audience: string;
  key_messages: string[];
  risk_items: string[];
  investment_ask: number;
  status: string;
  scheduled_date: string | null;
}

interface TrainingProgram {
  id: number;
  title: string;
  target_audience: string;
  format: string;
  duration_hours: number;
  modules: string[];
  status: string;
  enrolled_count: number;
}

interface Idea {
  id: number;
  title: string;
  submitter: string;
  category: string;
  description: string;
  feasibility: string;
  impact: string;
  status: string;
  votes: number;
}

const POC_STATUS_COLOR: Record<string, string> = {
  proposed: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};
const BRIEF_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
};
const FEASIBILITY_COLOR: Record<string, string> = {
  low: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-green-100 text-green-700',
};
const IMPACT_COLOR: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-purple-100 text-purple-700',
};
const IDEA_STATUS_COLOR: Record<string, string> = {
  backlog: 'bg-gray-100 text-gray-600',
  selected: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

const POC_COLUMNS = ['proposed', 'running', 'completed'] as const;

export default function AiAdvisoryPage() {
  const [tab, setTab] = useState<Tab>('Innovation Lab');
  const [pocs, setPocs] = useState<Poc[]>([]);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);
  const [designId, setDesignId] = useState<number | null>(null);
  const [designDoc, setDesignDoc] = useState('');
  const [generateId, setGenerateId] = useState<number | null>(null);
  const [briefingNarrative, setBriefingNarrative] = useState('');
  const [evaluateId, setEvaluateId] = useState<number | null>(null);
  const [evalResult, setEvalResult] = useState<Record<string, unknown> | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, bRes, tRes, iRes] = await Promise.all([
        fetch('/api/admin/ai-advisory/pocs'),
        fetch('/api/admin/ai-advisory/board'),
        fetch('/api/admin/ai-advisory/training'),
        fetch('/api/admin/ai-advisory/innovation'),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setPocs(d.pocs ?? []); }
      if (bRes.ok) { const d = await bRes.json(); setBriefings(d.briefings ?? []); }
      if (tRes.ok) { const d = await tRes.json(); setPrograms(d.programs ?? []); }
      if (iRes.ok) { const d = await iRes.json(); setIdeas(d.ideas ?? []); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const runPocDesign = async (id: number) => {
    setAiWorking(true);
    setDesignId(id);
    setDesignDoc('');
    try {
      const res = await fetch(`/api/admin/ai-advisory/pocs/${id}/design`, { method: 'POST' });
      const d = await res.json();
      setDesignDoc(d.design_document ?? '');
    } finally {
      setAiWorking(false);
    }
  };

  const runBriefingGenerate = async (id: number) => {
    setAiWorking(true);
    setGenerateId(id);
    setBriefingNarrative('');
    try {
      const res = await fetch(`/api/admin/ai-advisory/board/${id}/generate`, { method: 'POST' });
      const d = await res.json();
      setBriefingNarrative(d.narrative ?? '');
    } finally {
      setAiWorking(false);
    }
  };

  const runIdeaEvaluate = async (id: number) => {
    setAiWorking(true);
    setEvaluateId(id);
    setEvalResult(null);
    try {
      const res = await fetch(`/api/admin/ai-advisory/innovation/${id}/evaluate`, { method: 'POST' });
      const d = await res.json();
      setEvalResult(d.evaluation);
    } finally {
      setAiWorking(false);
    }
  };

  const voteIdea = async (id: number) => {
    await fetch('/api/admin/ai-advisory/innovation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote_id: id }),
    });
    loadAll();
  };

  const pocWinRate = pocs.length
    ? Math.round((pocs.filter(p => p.status === 'completed' && p.recommendation?.toLowerCase().includes('proceed')).length / pocs.length) * 100)
    : 0;
  const totalEnrolled = programs.reduce((s, p) => s + p.enrolled_count, 0);
  const activePrograms = programs.filter(p => p.status === 'active').length;
  const deliveredBriefings = briefings.filter(b => b.status === 'delivered').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-2xl font-bold">AI Advisory Center</h1>
        <p className="text-slate-300 text-sm mt-1">PoC advisory · Board briefings · Training · Innovation Lab</p>
      </div>

      <div className="flex border-b bg-white px-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {loading && <div className="text-center text-gray-400 py-10">Loading...</div>}

        {/* ── Innovation Lab ── */}
        {tab === 'Innovation Lab' && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ideas.map(idea => (
                <div key={idea.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${IDEA_STATUS_COLOR[idea.status] ?? ''}`}>{idea.status.replace('_', ' ')}</span>
                    <button onClick={() => voteIdea(idea.id)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
                      <span className="text-lg">▲</span>
                      <span className="font-bold">{idea.votes}</span>
                    </button>
                  </div>
                  <h3 className="font-bold text-gray-800 mb-1">{idea.title}</h3>
                  <div className="text-xs text-gray-500 mb-2">by {idea.submitter} · {idea.category?.replace('_', ' ')}</div>
                  <p className="text-sm text-gray-600 mb-3">{idea.description}</p>
                  <div className="flex gap-1 mb-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${FEASIBILITY_COLOR[idea.feasibility] ?? ''}`}>Feasibility: {idea.feasibility}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${IMPACT_COLOR[idea.impact] ?? ''}`}>Impact: {idea.impact}</span>
                  </div>
                  <button onClick={() => runIdeaEvaluate(idea.id)} disabled={aiWorking && evaluateId === idea.id}
                    className="w-full py-1.5 bg-purple-600 text-white rounded text-xs disabled:opacity-50">
                    {aiWorking && evaluateId === idea.id ? 'Evaluating...' : 'AI Evaluate'}
                  </button>
                  {evalResult && evaluateId === idea.id && (
                    <div className="mt-2 bg-purple-50 rounded p-2 text-xs text-gray-700">
                      <div className="grid grid-cols-2 gap-1 mb-1">
                        <div>Feasibility: <b>{(evalResult as Record<string, number>).feasibility_score}/10</b></div>
                        <div>Impact: <b>{(evalResult as Record<string, number>).impact_score}/10</b></div>
                        <div>Effort: <b>{(evalResult as Record<string, number>).estimated_effort_weeks}w</b></div>
                        <div>ROI: <b>{(evalResult as Record<string, number>).estimated_roi_pct}%</b></div>
                      </div>
                      <div className="font-medium text-purple-700">Rec: {(evalResult as Record<string, unknown>).recommendation as string}</div>
                      <div className="text-gray-600 mt-1">{(evalResult as Record<string, unknown>).next_step as string}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PoC / MVP Tracker ── */}
        {tab === 'PoC / MVP Tracker' && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-6">
              {POC_COLUMNS.map(col => (
                <div key={col} className="space-y-3">
                  <div className="font-semibold text-gray-700 capitalize border-b pb-2">{col} ({pocs.filter(p => p.status === col).length})</div>
                  {pocs.filter(p => p.status === col).map(poc => (
                    <div key={poc.id} className="bg-white rounded-lg border p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-800 text-sm">{poc.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${POC_STATUS_COLOR[poc.status] ?? ''}`}>{poc.status}</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-2">{poc.use_case} · {poc.duration_weeks}w</div>
                      <div className="text-xs text-gray-600 mb-2">{poc.hypothesis}</div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(poc.tech_stack ?? []).map(t => <span key={t} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{t}</span>)}
                      </div>
                      {poc.findings && <div className="text-xs text-green-700 mb-2 bg-green-50 rounded p-1.5">✓ {poc.findings}</div>}
                      {poc.recommendation && <div className="text-xs text-blue-700 mb-2">Rec: {poc.recommendation}</div>}
                      <button onClick={() => runPocDesign(poc.id)} disabled={aiWorking && designId === poc.id}
                        className="w-full py-1.5 bg-blue-600 text-white rounded text-xs disabled:opacity-50">
                        {aiWorking && designId === poc.id ? 'Generating...' : 'Generate Design Doc'}
                      </button>
                      {designDoc && designId === poc.id && (
                        <div className="mt-2 bg-blue-50 rounded p-2 text-xs text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">{designDoc}</div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Board Briefings ── */}
        {tab === 'Board Briefings' && !loading && (
          <div className="space-y-4">
            {briefings.map(b => (
              <div key={b.id} className="bg-white rounded-lg border p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">{b.title}</h3>
                    <div className="text-sm text-gray-500">{b.audience} · {b.scheduled_date ? new Date(b.scheduled_date).toLocaleDateString() : 'Date TBD'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${BRIEF_STATUS_COLOR[b.status] ?? ''}`}>{b.status}</span>
                    {Number(b.investment_ask) > 0 && (
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 font-medium">
                        Ask: ${Number(b.investment_ask).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">Key Messages</div>
                    {(b.key_messages ?? []).map((m, i) => <div key={i} className="text-sm text-gray-600">• {m}</div>)}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">Risk Items</div>
                    {(b.risk_items ?? []).map((r, i) => <div key={i} className="text-sm text-red-600">⚠ {r}</div>)}
                  </div>
                </div>
                <button onClick={() => runBriefingGenerate(b.id)} disabled={aiWorking && generateId === b.id}
                  className="px-4 py-1.5 bg-slate-700 text-white rounded text-sm disabled:opacity-50">
                  {aiWorking && generateId === b.id ? 'Generating...' : 'Generate AI Narrative'}
                </button>
                {briefingNarrative && generateId === b.id && (
                  <div className="mt-3 bg-gray-50 border rounded p-4 text-sm text-gray-700 whitespace-pre-wrap">{briefingNarrative}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Training & Enablement ── */}
        {tab === 'Training & Enablement' && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Total Enrolled</div>
                <div className="text-2xl font-bold text-blue-600">{totalEnrolled}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Active Programs</div>
                <div className="text-2xl font-bold text-green-600">{activePrograms}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Programs Total</div>
                <div className="text-2xl font-bold text-gray-700">{programs.length}</div>
              </div>
            </div>

            <div className="space-y-4">
              {programs.map(p => (
                <div key={p.id} className="bg-white rounded-lg border p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{p.title}</h3>
                      <div className="text-sm text-gray-500">{p.target_audience} · {p.format} · {Number(p.duration_hours)}h</div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                      <div className="text-sm text-gray-500 mt-1">{p.enrolled_count} enrolled</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(p.modules) ? p.modules : []).map((m: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{m}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Advisory Dashboard ── */}
        {tab === 'Advisory Dashboard' && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">PoC Win Rate</div>
                <div className="text-2xl font-bold text-green-600">{pocWinRate}%</div>
                <div className="text-xs text-gray-400">{pocs.filter(p => p.status === 'completed').length}/{pocs.length} completed</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Training Completion</div>
                <div className="text-2xl font-bold text-blue-600">{totalEnrolled}</div>
                <div className="text-xs text-gray-400">total enrolled across {programs.length} programs</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Briefings Delivered</div>
                <div className="text-2xl font-bold text-slate-700">{deliveredBriefings}</div>
                <div className="text-xs text-gray-400">{briefings.length} total</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="text-sm text-gray-500">Innovation Ideas</div>
                <div className="text-2xl font-bold text-purple-600">{ideas.length}</div>
                <div className="text-xs text-gray-400">{ideas.filter(i => i.status === 'in_progress').length} in progress</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border p-4">
                <h2 className="font-semibold text-gray-700 mb-3">PoC Pipeline</h2>
                {POC_COLUMNS.map(col => (
                  <div key={col} className="flex items-center gap-3 mb-2">
                    <span className="w-20 text-xs text-gray-500 capitalize">{col}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pocs.length ? (pocs.filter(p => p.status === col).length / pocs.length) * 100 : 0}%` }} />
                    </div>
                    <span className="text-sm font-medium w-6">{pocs.filter(p => p.status === col).length}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-lg border p-4">
                <h2 className="font-semibold text-gray-700 mb-3">Top Ideas by Votes</h2>
                {ideas.slice(0, 5).map(idea => (
                  <div key={idea.id} className="flex justify-between items-center py-1.5 border-b last:border-0">
                    <span className="text-sm text-gray-600 truncate max-w-xs">{idea.title}</span>
                    <span className="text-sm font-bold text-blue-600 ml-2">▲{idea.votes}</span>
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
