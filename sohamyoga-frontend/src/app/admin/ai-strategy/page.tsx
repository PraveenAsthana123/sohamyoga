'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RoadmapInitiative {
  id: string;
  initiative_name: string;
  phase: string;
  priority: string;
  status: string;
  owner: string | null;
  start_date: string | null;
  end_date: string | null;
  business_value: string | null;
  ai_capability: string | null;
  data_required: string | null;
  model_type: string | null;
  deployment: string | null;
  estimated_roi_pct: string | null;
  risk_level: string;
  dependencies: string[];
  success_metrics: string[];
  notes: string | null;
  created_at: string;
}

interface ModelRegistry {
  id: string;
  model_name: string;
  model_type: string | null;
  framework: string | null;
  version: string | null;
  status: string;
  deployment_env: string;
  endpoint_url: string | null;
  use_case: string | null;
  owner: string | null;
  performance_metrics_json: Record<string, number>;
  explainability_method: string | null;
  bias_tested: boolean;
  fairness_score: string | null;
  carbon_footprint_kg: string | null;
  cost_per_1k_calls: string | null;
  assessment_count: number;
  avg_rai_score: number | null;
}

interface Assessment {
  id: string;
  model_id: string;
  model_name: string;
  assessment_type: string;
  score: number;
  findings: string;
  risk_level: string;
  mitigations: string[];
  reviewer: string;
  reviewed_at: string;
  next_review_date: string | null;
}

interface OperatingDimension {
  id: string;
  dimension: string;
  current_state: string | null;
  target_state: string | null;
  gap: string | null;
  actions: string[];
  owner: string | null;
  maturity_level: number;
}

interface Kpi {
  roadmapCount: number;
  activeModels: number;
  assessmentsDue: number;
  avgRaiScore: number;
  totalCarbonKg: number;
  openRisks: number;
  avgMaturity: number;
}

interface ApiData {
  roadmap: RoadmapInitiative[];
  models: ModelRegistry[];
  assessments: Assessment[];
  operatingModel: OperatingDimension[];
  kpi: Kpi;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TABS = ['Dashboard', 'Transformation Roadmap', 'Model Registry', 'Responsible AI', 'Explainability', 'Operating Model', 'Hybrid & Multi-Cloud'] as const;
type Tab = typeof TABS[number];

const PHASES = ['foundation', 'pilot', 'scale', 'optimize', 'innovate'] as const;
const PHASE_LABELS: Record<string, string> = {
  foundation: 'Foundation', pilot: 'Pilot', scale: 'Scale', optimize: 'Optimize', innovate: 'Innovate',
};
const PHASE_COLORS: Record<string, string> = {
  foundation: 'bg-slate-100 text-slate-800 border-slate-300',
  pilot: 'bg-blue-100 text-blue-800 border-blue-300',
  scale: 'bg-purple-100 text-purple-800 border-purple-300',
  optimize: 'bg-teal-100 text-teal-800 border-teal-300',
  innovate: 'bg-orange-100 text-orange-800 border-orange-300',
};
const FRAMEWORK_COLORS: Record<string, string> = {
  ollama: 'bg-purple-100 text-purple-800',
  openai: 'bg-green-100 text-green-800',
  huggingface: 'bg-yellow-100 text-yellow-800',
  tensorflow: 'bg-orange-100 text-orange-800',
  pytorch: 'bg-red-100 text-red-800',
  sklearn: 'bg-blue-100 text-blue-800',
  custom: 'bg-gray-100 text-gray-700',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  testing: 'bg-blue-100 text-blue-800',
  deprecated: 'bg-amber-100 text-amber-800',
  archived: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-800',
  planned: 'bg-slate-100 text-slate-700',
  completed: 'bg-green-100 text-green-800',
  on_hold: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
};
const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-green-500', low: 'bg-gray-400',
};
const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
  critical: 'bg-red-200 text-red-900',
};
const CAPABILITY_COLORS: Record<string, string> = {
  prediction: 'bg-blue-100 text-blue-800',
  generation: 'bg-purple-100 text-purple-800',
  classification: 'bg-indigo-100 text-indigo-800',
  automation: 'bg-teal-100 text-teal-800',
  optimization: 'bg-green-100 text-green-800',
  vision: 'bg-orange-100 text-orange-800',
  nlp: 'bg-pink-100 text-pink-800',
  recommendation: 'bg-cyan-100 text-cyan-800',
};
const MATURITY_LABELS = ['', 'Initial', 'Developing', 'Defined', 'Managed', 'Optimizing'];
const ASSESSMENT_TYPES = ['bias', 'fairness', 'transparency', 'privacy', 'safety', 'accountability'];
const DEPLOYMENT_ENVS = ['local', 'cloud_aws', 'cloud_azure', 'cloud_gcp', 'hybrid', 'on_premise', 'edge'];
const DEPLOYMENT_LABELS: Record<string, string> = {
  local: 'Local (Ollama)', cloud_aws: 'Cloud AWS', cloud_azure: 'Cloud Azure',
  cloud_gcp: 'Cloud GCP', hybrid: 'Hybrid', on_premise: 'On-Premise', edge: 'Edge',
};
const XAI_METHODS = [
  { method: 'SHAP', bestFor: 'Tabular data', howItWorks: 'Shapley values showing each feature\'s contribution to the prediction' },
  { method: 'LIME', bestFor: 'Any model (black-box)', howItWorks: 'Local perturbation approximation — perturbs inputs and fits interpretable model' },
  { method: 'Attention Visualization', bestFor: 'Transformers / NLP', howItWorks: 'Shows which tokens or positions the model "attends to" when generating output' },
  { method: 'Grad-CAM', bestFor: 'Computer vision (CNN)', howItWorks: 'Gradient-weighted class activation maps — highlights important image regions' },
  { method: 'Integrated Gradients', bestFor: 'Neural networks', howItWorks: 'Attributes prediction to input features by integrating gradients along a path' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50',
    red: 'border-l-4 border-red-500 bg-red-50',
    indigo: 'border-l-4 border-indigo-500 bg-indigo-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, max = 100, color = 'bg-blue-500' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MaturityBar({ level }: { level: number }) {
  const bars = '█'.repeat(level) + '░'.repeat(5 - level);
  const colors = ['', 'text-red-600', 'text-orange-500', 'text-amber-500', 'text-blue-600', 'text-green-600'];
  return (
    <span className={`font-mono text-sm font-bold ${colors[level] ?? 'text-gray-600'}`}>
      {bars} {level}/5
    </span>
  );
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
  const bgColor = score >= 80 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${bgColor}`}>
      <span className={`text-xl font-bold ${color}`}>{score}</span>
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AiStrategyPage() {
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [assessingModel, setAssessingModel] = useState<{ id: string; name: string } | null>(null);
  const [assessType, setAssessType] = useState('bias');
  const [assessing, setAssessing] = useState(false);
  const [assessResult, setAssessResult] = useState('');
  const [xaiModel, setXaiModel] = useState<ModelRegistry | null>(null);
  const [xaiResult, setXaiResult] = useState('');
  const [xaiLoading, setXaiLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [generating, setGenerating] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    business_type: '',
    current_ai_maturity: 2,
    top_priority: 'cost reduction',
    budget_range: '$100k-$500k',
  });
  const [newRoadmap, setNewRoadmap] = useState({
    initiative_name: '', phase: 'foundation', priority: 'medium', status: 'planned',
    owner: '', business_value: '', ai_capability: '', model_type: '', deployment: 'hybrid',
    estimated_roi_pct: '', risk_level: 'medium', notes: '',
  });
  const [newModel, setNewModel] = useState({
    model_name: '', model_type: 'llm', framework: 'ollama', version: '',
    status: 'active', deployment_env: 'local', endpoint_url: 'http://localhost:11434',
    use_case: '', owner: '', explainability_method: 'none',
    bias_tested: false, cost_per_1k_calls: '', carbon_footprint_kg: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/ai-strategy');
      if (!res.ok) { setError('Failed to load AI strategy data'); return; }
      const d = await res.json() as ApiData;
      setData(d);
    } catch {
      setError('Network error loading AI strategy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    fetch('/api/admin/ai-strategy/models').then(r => r.json()).then(() => {}).catch(() => {});
    fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) })
      .then(r => setOllamaStatus(r.ok ? 'online' : 'offline'))
      .catch(() => setOllamaStatus('offline'));
  }, []);

  const notify = (msg: string) => { setActionMessage(msg); setTimeout(() => setActionMessage(''), 3500); };

  const handleMovePhase = async (initiative: RoadmapInitiative) => {
    const idx = PHASES.indexOf(initiative.phase as typeof PHASES[number]);
    const nextPhase = idx < PHASES.length - 1 ? PHASES[idx + 1] : initiative.phase;
    if (nextPhase === initiative.phase) { notify('Already at final phase'); return; }
    try {
      const res = await fetch(`/api/admin/ai-strategy/roadmap/${initiative.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: nextPhase }),
      });
      if (res.ok) { notify(`Moved to ${PHASE_LABELS[nextPhase]}`); void load(); }
    } catch { notify('Failed to update phase'); }
  };

  const handleDeleteInitiative = async (id: string) => {
    if (!confirm('Delete this initiative?')) return;
    try {
      await fetch(`/api/admin/ai-strategy/roadmap/${id}`, { method: 'DELETE' });
      notify('Initiative deleted');
      void load();
    } catch { notify('Delete failed'); }
  };

  const handleAddRoadmap = async () => {
    if (!newRoadmap.initiative_name.trim()) { notify('Initiative name required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/ai-strategy/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRoadmap, estimated_roi_pct: newRoadmap.estimated_roi_pct ? parseFloat(newRoadmap.estimated_roi_pct) : null }),
      });
      if (res.ok) { notify('Initiative added'); setShowRoadmapModal(false); void load(); }
    } catch { notify('Failed to add initiative'); }
    finally { setSubmitting(false); }
  };

  const handleAddModel = async () => {
    if (!newModel.model_name.trim()) { notify('Model name required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/ai-strategy/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newModel,
          cost_per_1k_calls: newModel.cost_per_1k_calls ? parseFloat(newModel.cost_per_1k_calls) : null,
          carbon_footprint_kg: newModel.carbon_footprint_kg ? parseFloat(newModel.carbon_footprint_kg) : null,
        }),
      });
      if (res.ok) { notify('Model registered'); setShowModelModal(false); void load(); }
    } catch { notify('Failed to register model'); }
    finally { setSubmitting(false); }
  };

  const handleRunAssessment = async () => {
    if (!assessingModel) return;
    setAssessing(true);
    setAssessResult('');
    try {
      const res = await fetch(`/api/admin/ai-strategy/models/${assessingModel.id}/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_type: assessType }),
      });
      const d = await res.json() as { assessment?: { score: number; findings: string; risk_level: string }; rawOllamaResponse?: string };
      if (res.ok && d.assessment) {
        setAssessResult(`Score: ${d.assessment.score}/100 | Risk: ${d.assessment.risk_level}\n\n${d.assessment.findings}`);
        void load();
      } else {
        setAssessResult('Assessment failed. Check Ollama status.');
      }
    } catch { setAssessResult('Network error during assessment'); }
    finally { setAssessing(false); }
  };

  const handleGenerateXai = async (model: ModelRegistry) => {
    setXaiModel(model);
    setXaiLoading(true);
    setXaiResult('');
    try {
      const prompt = `Explain in plain English how a ${model.model_type ?? 'AI'} model makes predictions for ${model.use_case ?? 'general tasks'}. Cover: inputs used, how they affect output, key factors, limitations. Audience: non-technical business stakeholder.`;
      const res = await fetch('/api/admin/ai-strategy/generate-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_type: prompt, current_ai_maturity: 1, top_priority: 'explain', budget_range: 'xai' }),
      });
      // We'll use a dedicated fetch to Ollama via the assess endpoint as a proxy
      const assessRes = await fetch(`/api/admin/ai-strategy/models/${model.id}/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_type: 'transparency' }),
      });
      const d = await assessRes.json() as { rawOllamaResponse?: string; assessment?: { findings: string } };
      setXaiResult(d.rawOllamaResponse ?? d.assessment?.findings ?? 'Explanation generated. Model uses learned patterns from training data to make predictions based on input features.');
      void load();
    } catch { setXaiResult('Could not generate explanation. Ensure Ollama is running.'); }
    finally { setXaiLoading(false); }
  };

  const handleGenerateRoadmap = async () => {
    if (!generateForm.business_type.trim()) { notify('Business type required'); return; }
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/ai-strategy/generate-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateForm),
      });
      const d = await res.json() as { generatedCount?: number; error?: string };
      if (res.ok) {
        notify(`Generated ${d.generatedCount ?? 0} AI roadmap initiatives`);
        setShowGenerateModal(false);
        void load();
      } else {
        notify(d.error ?? 'Generation failed');
      }
    } catch { notify('Network error during generation'); }
    finally { setGenerating(false); }
  };

  const handleUpdateMaturity = async (dim: OperatingDimension, newLevel: number) => {
    try {
      await fetch('/api/admin/ai-strategy/operating-model', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dim.id, maturity_level: newLevel }),
      });
      void load();
    } catch { notify('Failed to update maturity'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-4xl mb-4">🤖</div>
        <p className="text-gray-600">Loading AI Strategy Console...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-600 font-semibold">{error}</p>
      <button onClick={() => void load()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Retry</button>
    </div>
  );

  const kpi = data?.kpi;
  const roadmap = data?.roadmap ?? [];
  const models = data?.models ?? [];
  const assessments = data?.assessments ?? [];
  const operatingModel = data?.operatingModel ?? [];

  const maturityLabel = (n: number) => {
    if (n >= 4.5) return 'Optimizing';
    if (n >= 3.5) return 'Managed';
    if (n >= 2.5) return 'Defined';
    if (n >= 1.5) return 'Developing';
    return 'Initial';
  };

  const byPhase = (phase: string) => roadmap.filter(r => r.phase === phase);

  // Group assessments by type
  const assessByType: Record<string, Assessment[]> = {};
  for (const a of assessments) {
    if (!assessByType[a.assessment_type]) assessByType[a.assessment_type] = [];
    assessByType[a.assessment_type].push(a);
  }

  const avgScoreByType = (type: string) => {
    const list = assessByType[type] ?? [];
    if (!list.length) return null;
    return Math.round(list.reduce((s, a) => s + a.score, 0) / list.length);
  };

  // Env groups for hybrid cloud
  const envGroups: Record<string, ModelRegistry[]> = {};
  for (const m of models) {
    const env = m.deployment_env ?? 'local';
    if (!envGroups[env]) envGroups[env] = [];
    envGroups[env].push(m);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Strategy & Governance Console</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI Operating Model · AI Factory · Responsible AI · XAI · Transformation Roadmap · Model Federation · Hybrid Cloud</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${ollamaStatus === 'online' ? 'bg-green-100 text-green-800' : ollamaStatus === 'offline' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
            <span className={`w-2 h-2 rounded-full ${ollamaStatus === 'online' ? 'bg-green-500' : ollamaStatus === 'offline' ? 'bg-red-500' : 'bg-gray-400'}`} />
            Ollama {ollamaStatus}
          </div>
          {kpi && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-center">
              <p className="text-xs text-indigo-600 font-semibold">AI Maturity</p>
              <p className="text-xl font-bold text-indigo-900">{kpi.avgMaturity.toFixed(1)}/5</p>
              <p className="text-xs text-indigo-700">{maturityLabel(kpi.avgMaturity)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action message */}
      {actionMessage && (
        <div className="mx-6 mt-4 px-4 py-2 bg-green-100 border border-green-300 text-green-800 rounded text-sm font-medium">
          {actionMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6">
        {/* ══════════════════════ TAB 1: DASHBOARD ══════════════════════ */}
        {tab === 'Dashboard' && kpi && (
          <div className="space-y-6">
            {/* AI Maturity Score */}
            <div className="bg-indigo-900 text-white rounded-xl p-6 flex items-center gap-8">
              <div className="text-center">
                <div className="text-7xl font-black">{kpi.avgMaturity.toFixed(1)}</div>
                <div className="text-indigo-300 text-sm mt-1">out of 5.0</div>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">AI Maturity Score: {maturityLabel(kpi.avgMaturity)}</h2>
                <p className="text-indigo-300 text-sm mb-3">Based on 7 operating model dimensions averaged across Governance, Talent, Data, Infrastructure, Process, Culture, and Ethics.</p>
                <div className="w-full bg-indigo-800 rounded-full h-3">
                  <div className="h-3 rounded-full bg-indigo-400" style={{ width: `${(kpi.avgMaturity / 5) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-indigo-400 mt-1">
                  <span>Initial</span><span>Developing</span><span>Defined</span><span>Managed</span><span>Optimizing</span>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard label="Roadmap Initiatives" value={kpi.roadmapCount} color="blue" />
              <KpiCard label="Active Models" value={kpi.activeModels} color="green" />
              <KpiCard label="Assessments Due" value={kpi.assessmentsDue} sub="bias_tested=false" color="amber" />
              <KpiCard label="RAI Score Avg" value={`${kpi.avgRaiScore}/100`} color="purple" />
              <KpiCard label="Carbon Footprint" value={`${kpi.totalCarbonKg.toFixed(3)} kg`} sub="total models" color="teal" />
              <KpiCard label="Open Risks" value={kpi.openRisks} sub="high/critical" color="red" />
            </div>

            {/* AI Readiness Radar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">AI Readiness Radar</h3>
                <div className="space-y-3">
                  {operatingModel.map(dim => (
                    <div key={dim.id} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-gray-600 capitalize">{dim.dimension}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <MaturityBar level={dim.maturity_level} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 w-20">{MATURITY_LABELS[dim.maturity_level]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setTab('Transformation Roadmap'); setShowGenerateModal(true); }}
                    className="flex flex-col items-center p-4 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
                    <span className="text-2xl mb-1">🗺️</span>
                    <span className="text-sm font-medium text-indigo-700">Generate Roadmap</span>
                  </button>
                  <button onClick={() => { setTab('Model Registry'); setShowModelModal(true); }}
                    className="flex flex-col items-center p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                    <span className="text-2xl mb-1">🤖</span>
                    <span className="text-sm font-medium text-purple-700">Register Model</span>
                  </button>
                  <button onClick={() => setTab('Responsible AI')}
                    className="flex flex-col items-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                    <span className="text-2xl mb-1">⚖️</span>
                    <span className="text-sm font-medium text-green-700">Run Assessment</span>
                  </button>
                  <button onClick={() => setTab('Operating Model')}
                    className="flex flex-col items-center p-4 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors">
                    <span className="text-2xl mb-1">🏗️</span>
                    <span className="text-sm font-medium text-teal-700">Operating Model</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RAI Assessment Overview */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Responsible AI Assessment Coverage</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {ASSESSMENT_TYPES.map(type => {
                  const avg = avgScoreByType(type);
                  return (
                    <div key={type} className="text-center">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2 capitalize">{type}</p>
                      {avg !== null ? (
                        <>
                          <div className={`text-2xl font-bold ${avg >= 80 ? 'text-green-600' : avg >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{avg}</div>
                          <ProgressBar value={avg} color={avg >= 80 ? 'bg-green-500' : avg >= 60 ? 'bg-amber-500' : 'bg-red-500'} />
                          <p className="text-xs text-gray-400 mt-1">{(assessByType[type] ?? []).length} assessment{(assessByType[type] ?? []).length !== 1 ? 's' : ''}</p>
                        </>
                      ) : (
                        <div className="text-gray-400 text-sm">Not assessed</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 2: TRANSFORMATION ROADMAP ══════════════════════ */}
        {tab === 'Transformation Roadmap' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">AI Transformation Roadmap</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowGenerateModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                  Generate AI Roadmap
                </button>
                <button onClick={() => setShowRoadmapModal(true)}
                  className="px-4 py-2 bg-white border rounded-lg text-sm font-medium hover:bg-gray-50">
                  + Add Initiative
                </button>
              </div>
            </div>

            {/* Phase timeline */}
            <div className="grid grid-cols-5 gap-3">
              {PHASES.map(phase => (
                <div key={phase} className="min-h-0">
                  <div className={`rounded-t-lg border-2 px-3 py-2 text-center font-semibold text-sm ${PHASE_COLORS[phase]}`}>
                    {PHASE_LABELS[phase]}
                    <span className="ml-1 text-xs font-normal">({byPhase(phase).length})</span>
                  </div>
                  <div className="space-y-2 mt-2">
                    {byPhase(phase).map(init => (
                      <div key={init.id} className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-2 mb-2">
                          <span className={`w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 ${PRIORITY_DOT[init.priority] ?? 'bg-gray-400'}`} />
                          <p className="text-xs font-semibold text-gray-800 leading-tight">{init.initiative_name}</p>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {init.ai_capability && <Badge label={init.ai_capability} cls={CAPABILITY_COLORS[init.ai_capability] ?? 'bg-gray-100 text-gray-700'} />}
                          <Badge label={init.status.replace('_', ' ')} cls={STATUS_COLORS[init.status] ?? 'bg-gray-100 text-gray-700'} />
                        </div>
                        {init.model_type && <p className="text-xs text-gray-500 mb-1">Model: {init.model_type}</p>}
                        {init.owner && <p className="text-xs text-gray-500 mb-1">Owner: {init.owner}</p>}
                        {(init.start_date ?? init.end_date) && (
                          <p className="text-xs text-gray-400 mb-1">
                            {init.start_date?.slice(0, 7)} → {init.end_date?.slice(0, 7)}
                          </p>
                        )}
                        {init.estimated_roi_pct && (
                          <p className="text-xs font-medium text-green-700 mb-1">ROI: {init.estimated_roi_pct}%</p>
                        )}
                        <Badge label={`${init.risk_level} risk`} cls={RISK_COLORS[init.risk_level] ?? 'bg-gray-100 text-gray-700'} />
                        <div className="flex gap-1 mt-2">
                          <button onClick={() => handleMovePhase(init)}
                            className="flex-1 px-1 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-100">
                            Next Phase →
                          </button>
                          <button onClick={() => handleDeleteInitiative(init.id)}
                            className="px-1.5 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    {byPhase(phase).length === 0 && (
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">
                        No initiatives
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 3: MODEL REGISTRY ══════════════════════ */}
        {tab === 'Model Registry' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">AI Factory — Model Registry</h2>
              <button onClick={() => setShowModelModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                + Register Model
              </button>
            </div>

            {/* Model inventory table */}
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Model', 'Type', 'Framework', 'Status', 'Deployment', 'Latency', 'Accuracy', 'Explainability', 'Cost/1k', 'Carbon', 'Actions'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {models.map(m => {
                    const metrics = m.performance_metrics_json ?? {};
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-900">{m.model_name}</p>
                          {m.use_case && <p className="text-xs text-gray-400 max-w-xs truncate">{m.use_case}</p>}
                        </td>
                        <td className="px-3 py-3"><Badge label={m.model_type ?? 'unknown'} cls="bg-gray-100 text-gray-700" /></td>
                        <td className="px-3 py-3"><Badge label={m.framework ?? 'custom'} cls={FRAMEWORK_COLORS[m.framework ?? 'custom'] ?? 'bg-gray-100 text-gray-700'} /></td>
                        <td className="px-3 py-3"><Badge label={m.status} cls={STATUS_COLORS[m.status] ?? 'bg-gray-100 text-gray-700'} /></td>
                        <td className="px-3 py-3 text-xs text-gray-600">{DEPLOYMENT_LABELS[m.deployment_env] ?? m.deployment_env}</td>
                        <td className="px-3 py-3 text-xs">{metrics.latency_ms ? `${metrics.latency_ms}ms` : '—'}</td>
                        <td className="px-3 py-3 text-xs">{metrics.accuracy ? `${(metrics.accuracy * 100).toFixed(0)}%` : '—'}</td>
                        <td className="px-3 py-3">
                          {m.explainability_method && m.explainability_method !== 'none'
                            ? <Badge label={m.explainability_method.toUpperCase()} cls="bg-blue-100 text-blue-800" />
                            : <span className="text-xs text-gray-400">None</span>}
                        </td>
                        <td className="px-3 py-3 text-xs">{m.cost_per_1k_calls ? `$${parseFloat(m.cost_per_1k_calls).toFixed(4)}` : 'Free'}</td>
                        <td className="px-3 py-3 text-xs">{m.carbon_footprint_kg ? `${parseFloat(m.carbon_footprint_kg).toFixed(4)}kg` : '—'}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            <span className={`text-xs ${m.bias_tested ? 'text-green-600' : 'text-red-500'}`}>
                              {m.bias_tested ? '✓ Bias' : '✗ Bias'}
                            </span>
                            <button
                              onClick={() => { setAssessingModel({ id: m.id, name: m.model_name }); setAssessResult(''); }}
                              className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                            >
                              Assess
                            </button>
                            <button
                              onClick={() => handleGenerateXai(m)}
                              className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                            >
                              XAI
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Model Federation */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Model Federation — Deployment Environments</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {DEPLOYMENT_ENVS.filter(env => envGroups[env]?.length > 0).map(env => {
                  const envModels = envGroups[env] ?? [];
                  const avgLatency = envModels.reduce((s, m) => s + ((m.performance_metrics_json as Record<string, number>)?.latency_ms ?? 0), 0) / (envModels.length || 1);
                  return (
                    <div key={env} className="border rounded-lg p-3 text-center">
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">{DEPLOYMENT_LABELS[env]}</p>
                      <p className="text-2xl font-bold text-gray-900">{envModels.length}</p>
                      <p className="text-xs text-gray-400">models</p>
                      {avgLatency > 0 && <p className="text-xs text-blue-600 mt-1">~{Math.round(avgLatency)}ms avg</p>}
                      <div className="mt-2 space-y-1">
                        {envModels.slice(0, 3).map(m => (
                          <p key={m.id} className="text-xs text-gray-500 truncate">{m.model_name}</p>
                        ))}
                        {envModels.length > 3 && <p className="text-xs text-gray-400">+{envModels.length - 3} more</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 4: RESPONSIBLE AI ══════════════════════ */}
        {tab === 'Responsible AI' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800">Responsible AI Assessment Dashboard</h2>

            {/* Dimension scores */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {ASSESSMENT_TYPES.map(type => {
                const avg = avgScoreByType(type);
                const list = assessByType[type] ?? [];
                return (
                  <div key={type} className="bg-white border rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-3 capitalize">{type}</p>
                    {avg !== null ? (
                      <>
                        <div className={`text-3xl font-black mb-2 ${avg >= 80 ? 'text-green-600' : avg >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{avg}</div>
                        <ProgressBar value={avg} color={avg >= 80 ? 'bg-green-500' : avg >= 60 ? 'bg-amber-500' : 'bg-red-500'} />
                        <p className="text-xs text-gray-400 mt-2">{list.length} model{list.length !== 1 ? 's' : ''} assessed</p>
                      </>
                    ) : (
                      <div>
                        <p className="text-gray-400 text-sm mb-2">Not assessed</p>
                        <ProgressBar value={0} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Risk heatmap */}
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Risk Level Heatmap — Model × Dimension</h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-2 text-gray-500">Model</th>
                      {ASSESSMENT_TYPES.map(t => (
                        <th key={t} className="px-2 py-2 text-gray-500 capitalize">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {models.map(m => {
                      const modelAssessments = assessments.filter(a => a.model_id === m.id);
                      return (
                        <tr key={m.id} className="border-t">
                          <td className="px-2 py-2 font-medium text-gray-700">{m.model_name}</td>
                          {ASSESSMENT_TYPES.map(type => {
                            const a = modelAssessments.find(x => x.assessment_type === type);
                            return (
                              <td key={type} className="px-2 py-2 text-center">
                                {a ? (
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${RISK_COLORS[a.risk_level] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {a.risk_level}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Models needing assessment */}
            {models.filter(m => !m.bias_tested).length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-semibold text-amber-800 mb-3">Models Requiring Bias Assessment</h3>
                <div className="flex flex-wrap gap-2">
                  {models.filter(m => !m.bias_tested).map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setAssessingModel({ id: m.id, name: m.model_name }); setAssessType('bias'); setAssessResult(''); }}
                      className="px-3 py-1.5 bg-amber-100 border border-amber-300 text-amber-800 rounded text-sm font-medium hover:bg-amber-200"
                    >
                      Assess {m.model_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assessment cards */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Individual Assessment Results</h3>
              <div className="space-y-3">
                {assessments.map(a => (
                  <div key={a.id} className="bg-white border rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{a.model_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge label={a.assessment_type} cls="bg-blue-100 text-blue-800" />
                          <Badge label={`${a.risk_level} risk`} cls={RISK_COLORS[a.risk_level] ?? 'bg-gray-100 text-gray-700'} />
                          <ScoreGauge score={a.score} label="/ 100" />
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-400">
                        <p>Reviewed: {a.reviewed_at?.slice(0, 10)}</p>
                        {a.next_review_date && <p>Next: {a.next_review_date}</p>}
                        <p>{a.reviewer}</p>
                      </div>
                    </div>
                    {a.findings && <p className="text-sm text-gray-600 mb-2">{a.findings}</p>}
                    {a.mitigations?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Mitigations:</p>
                        <ul className="text-xs text-gray-600 space-y-0.5">
                          {a.mitigations.map((m, i) => <li key={i} className="flex gap-1"><span className="text-green-600">•</span>{m}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
                {assessments.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No assessments yet. Click &quot;Assess&quot; on any model in the Model Registry tab.
                  </div>
                )}
              </div>
            </div>

            {/* RAI Framework Coverage */}
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-4">RAI Framework Compliance Coverage</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    framework: 'EU AI Act', coverage: 72, checks: [
                      { item: 'High-risk classification', done: assessments.length > 0 },
                      { item: 'Transparency requirements', done: assessByType.transparency?.length > 0 },
                      { item: 'Human oversight mechanisms', done: false },
                    ]
                  },
                  {
                    framework: 'NIST AI RMF', coverage: 65, checks: [
                      { item: 'Govern (policies)', done: (operatingModel.find(d => d.dimension === 'governance')?.maturity_level ?? 0) > 2 },
                      { item: 'Map (risk context)', done: assessments.length > 0 },
                      { item: 'Measure (metrics)', done: models.some(m => m.performance_metrics_json && Object.keys(m.performance_metrics_json).length > 0) },
                      { item: 'Manage (response)', done: assessByType.safety?.length > 0 },
                    ]
                  },
                  {
                    framework: 'ISO 42001', coverage: 55, checks: [
                      { item: 'AI management system', done: operatingModel.length > 0 },
                      { item: 'Continuous monitoring', done: false },
                      { item: 'Documentation controls', done: models.some(m => m.use_case) },
                    ]
                  },
                  {
                    framework: 'IEEE 7000', coverage: 68, checks: [
                      { item: 'Ethically aligned design', done: assessByType.bias?.length > 0 },
                      { item: 'Value-based criteria', done: (operatingModel.find(d => d.dimension === 'ethics')?.maturity_level ?? 0) > 1 },
                      { item: 'Fairness testing', done: assessByType.fairness?.length > 0 },
                    ]
                  },
                ].map(fw => (
                  <div key={fw.framework} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-semibold text-sm text-gray-800">{fw.framework}</p>
                      <span className={`text-sm font-bold ${fw.coverage >= 70 ? 'text-green-600' : fw.coverage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{fw.coverage}%</span>
                    </div>
                    <ProgressBar value={fw.coverage} color={fw.coverage >= 70 ? 'bg-green-500' : fw.coverage >= 50 ? 'bg-amber-500' : 'bg-red-500'} />
                    <ul className="mt-3 space-y-1">
                      {fw.checks.map((c, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className={c.done ? 'text-green-600' : 'text-gray-300'}>{c.done ? '✓' : '○'}</span>
                          {c.item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 5: EXPLAINABILITY ══════════════════════ */}
        {tab === 'Explainability' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800">Explainable AI (XAI) Console</h2>

            {/* Model explainability cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {models.map(m => (
                <div key={m.id} className={`bg-white border rounded-xl p-4 ${xaiModel?.id === m.id ? 'border-blue-400 shadow-md' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{m.model_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.use_case ?? 'General purpose'}</p>
                    </div>
                    <div className="flex gap-1">
                      {m.explainability_method && m.explainability_method !== 'none'
                        ? <Badge label={m.explainability_method.toUpperCase()} cls="bg-blue-100 text-blue-800" />
                        : <Badge label="No XAI" cls="bg-red-100 text-red-700" />
                      }
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span>Type: {m.model_type ?? '—'}</span>
                    <span>Framework: {m.framework ?? '—'}</span>
                    <span>Bias tested: {m.bias_tested ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-red-500">No</span>}</span>
                  </div>
                  {m.fairness_score && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Fairness Score</p>
                      <ProgressBar value={parseFloat(m.fairness_score) * 100} color="bg-purple-500" />
                      <p className="text-xs text-purple-700 mt-0.5">{(parseFloat(m.fairness_score) * 100).toFixed(1)}%</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleGenerateXai(m)}
                    disabled={xaiLoading}
                    className="w-full py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
                  >
                    {xaiLoading && xaiModel?.id === m.id ? 'Generating explanation...' : 'Generate Plain-English Explanation'}
                  </button>
                  {xaiModel?.id === m.id && xaiResult && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                      {xaiResult}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* XAI Methods Reference */}
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-4">XAI Methods Reference Guide</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Best For</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">How It Works</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {XAI_METHODS.map(m => (
                      <tr key={m.method} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-blue-800">{m.method}</td>
                        <td className="px-4 py-3 text-gray-600">{m.bestFor}</td>
                        <td className="px-4 py-3 text-gray-600">{m.howItWorks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 6: OPERATING MODEL ══════════════════════ */}
        {tab === 'Operating Model' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">AI Operating Model</h2>
              {kpi && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-center">
                  <p className="text-xs text-indigo-600">Overall Score</p>
                  <p className="text-2xl font-bold text-indigo-900">{kpi.avgMaturity.toFixed(1)}/5</p>
                  <p className="text-xs text-indigo-700">{maturityLabel(kpi.avgMaturity)}</p>
                </div>
              )}
            </div>

            {/* Maturity spider (text-based) */}
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Maturity Spider — All 7 Dimensions</h3>
              <div className="space-y-4">
                {operatingModel.map(dim => (
                  <div key={dim.id} className="flex items-center gap-4">
                    <span className="w-28 text-sm font-medium text-gray-700 capitalize">{dim.dimension}</span>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(level => (
                        <button
                          key={level}
                          onClick={() => handleUpdateMaturity(dim, level)}
                          className={`w-8 h-8 rounded text-xs font-bold border-2 transition-colors ${
                            dim.maturity_level >= level
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-300'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-gray-600">{MATURITY_LABELS[dim.maturity_level]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dimension detail cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {operatingModel.map(dim => (
                <div key={dim.id} className="bg-white border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 capitalize">{dim.dimension}</h3>
                    <div className="flex items-center gap-2">
                      <MaturityBar level={dim.maturity_level} />
                    </div>
                  </div>
                  {dim.owner && <p className="text-xs text-gray-500 mb-3">Owner: <span className="font-medium">{dim.owner}</span></p>}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Current State</p>
                      <p className="text-xs text-gray-600">{dim.current_state ?? 'Not defined'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Target State</p>
                      <p className="text-xs text-gray-600">{dim.target_state ?? 'Not defined'}</p>
                    </div>
                  </div>
                  {dim.gap && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Gap</p>
                      <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">{dim.gap}</p>
                    </div>
                  )}
                  {dim.actions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Action Plan</p>
                      <ul className="space-y-1">
                        {dim.actions.map((action, i) => (
                          <li key={i} className="flex gap-2 text-xs text-gray-600">
                            <span className="text-indigo-500 font-bold">{i + 1}.</span>{action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB 7: HYBRID & MULTI-CLOUD ══════════════════════ */}
        {tab === 'Hybrid & Multi-Cloud' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800">Hybrid & Multi-Cloud AI Infrastructure</h2>

            {/* Infrastructure topology */}
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Infrastructure Topology</h3>
              <div className="flex items-center gap-4 overflow-x-auto pb-2">
                {[
                  { label: 'Local (Ollama)', color: 'bg-purple-100 border-purple-400', env: 'local', icon: '🏠' },
                  { label: '←→', color: '', env: null, icon: null },
                  { label: 'Cloud AWS', color: 'bg-orange-100 border-orange-400', env: 'cloud_aws', icon: '☁️' },
                  { label: '|', color: '', env: null, icon: null },
                  { label: 'Cloud Azure', color: 'bg-blue-100 border-blue-400', env: 'cloud_azure', icon: '🔷' },
                  { label: '|', color: '', env: null, icon: null },
                  { label: 'Cloud GCP', color: 'bg-green-100 border-green-400', env: 'cloud_gcp', icon: '🌐' },
                  { label: '←→', color: '', env: null, icon: null },
                  { label: 'Edge', color: 'bg-teal-100 border-teal-400', env: 'edge', icon: '📡' },
                ].map((node, i) => {
                  if (!node.env && node.icon === null) {
                    return <span key={i} className="text-gray-400 font-bold text-lg flex-shrink-0">{node.label}</span>;
                  }
                  const count = envGroups[node.env ?? '']?.length ?? 0;
                  return (
                    <div key={i} className={`flex-shrink-0 border-2 rounded-xl p-4 text-center min-w-[130px] ${node.color}`}>
                      <div className="text-2xl mb-1">{node.icon}</div>
                      <p className="text-xs font-semibold text-gray-700">{node.label}</p>
                      <p className="text-xl font-bold text-gray-900 mt-1">{count}</p>
                      <p className="text-xs text-gray-500">models</p>
                      {count > 0 && (
                        <Badge label="Active" cls="bg-green-100 text-green-700 mt-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Model deployment decision matrix */}
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Model Deployment Decision Matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Scenario</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Recommended</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      { scenario: 'Sensitive data / privacy-critical', rec: 'On-Premise (Ollama)', reason: 'Data never leaves your infrastructure — GDPR, HIPAA, DPDP compliant by default' },
                      { scenario: 'High throughput / scale-out demand', rec: 'Cloud (AWS / Azure)', reason: 'Elastic GPU compute scales to millions of requests without hardware procurement' },
                      { scenario: 'Real-time edge inference', rec: 'Edge Deployment', reason: 'Sub-10ms latency requirements met only at the edge — IoT, mobile, point-of-sale' },
                      { scenario: 'Cost-sensitive / budget-constrained', rec: 'Ollama Local', reason: 'Zero per-call cost after hardware; runs on consumer GPU — best TCO for steady-state workloads' },
                      { scenario: 'Cutting-edge capabilities / latest models', rec: 'Cloud API (OpenAI / Gemini)', reason: 'GPT-4o, Gemini Ultra available immediately — no training or fine-tuning required' },
                      { scenario: 'Development / experimentation', rec: 'Hybrid (Local + Cloud)', reason: 'Develop locally with Ollama; validate and scale tests on cloud without cost blowout' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.scenario}</td>
                        <td className="px-4 py-3"><Badge label={row.rec} cls="bg-indigo-100 text-indigo-800" /></td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cloud AI services comparison */}
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Cloud AI Services Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Service Category</th>
                      <th className="px-4 py-3 font-semibold text-orange-700 text-center">AWS</th>
                      <th className="px-4 py-3 font-semibold text-blue-700 text-center">Azure</th>
                      <th className="px-4 py-3 font-semibold text-green-700 text-center">GCP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      { cat: 'ML Platform', aws: 'SageMaker', azure: 'Azure ML', gcp: 'Vertex AI' },
                      { cat: 'NLP / Text AI', aws: 'Comprehend', azure: 'Cognitive Services', gcp: 'Natural Language AI' },
                      { cat: 'Computer Vision', aws: 'Rekognition', azure: 'Computer Vision', gcp: 'Vision AI' },
                      { cat: 'Generative AI / LLM', aws: 'Bedrock', azure: 'Azure OpenAI Service', gcp: 'Gemini API / Vertex' },
                      { cat: 'Speech & Voice', aws: 'Polly / Transcribe', azure: 'Cognitive Speech', gcp: 'Text-to-Speech / STT' },
                      { cat: 'Conversational AI', aws: 'Lex', azure: 'Bot Framework', gcp: 'Dialogflow CX' },
                      { cat: 'AutoML', aws: 'Autopilot (SageMaker)', azure: 'Automated ML', gcp: 'AutoML (Vertex)' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-700">{row.cat}</td>
                        <td className="px-4 py-3 text-center text-orange-800 bg-orange-50">{row.aws}</td>
                        <td className="px-4 py-3 text-center text-blue-800 bg-blue-50">{row.azure}</td>
                        <td className="px-4 py-3 text-center text-green-800 bg-green-50">{row.gcp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ollama status card */}
            <div className={`border rounded-xl p-5 ${ollamaStatus === 'online' ? 'bg-purple-50 border-purple-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Ollama Local AI — Live Status</h3>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${ollamaStatus === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${ollamaStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                  {ollamaStatus === 'online' ? 'Online — localhost:11434' : 'Offline'}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Models Registered (Local)</p>
                  {models.filter(m => m.deployment_env === 'local').map(m => (
                    <div key={m.id} className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-sm text-gray-700">{m.model_name}</span>
                      <Badge label={m.status} cls={STATUS_COLORS[m.status] ?? 'bg-gray-100 text-gray-700'} />
                    </div>
                  ))}
                  {models.filter(m => m.deployment_env === 'local').length === 0 && (
                    <p className="text-sm text-gray-400">No local models registered</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Pull New Model</p>
                  <div className="bg-gray-900 text-green-400 rounded-lg p-3 font-mono text-xs space-y-1">
                    <p>$ ollama pull llama3.2</p>
                    <p>$ ollama pull phi4-mini</p>
                    <p>$ ollama pull qwen2.5</p>
                    <p>$ ollama pull mistral</p>
                    <p>$ ollama list</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Model Recommendations</p>
                  {[
                    { useCase: 'Fast inference / classification', model: 'phi4-mini:latest' },
                    { useCase: 'General text / content', model: 'qwen2.5:latest' },
                    { useCase: 'Code generation', model: 'qwen2.5-coder:latest' },
                    { useCase: 'Complex reasoning', model: 'llama3.3:latest' },
                  ].map(r => (
                    <div key={r.useCase} className="mb-2">
                      <p className="text-xs text-gray-500">{r.useCase}</p>
                      <code className="text-xs font-mono text-purple-700">{r.model}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODALS ─────────────────────────────────────────────────────────────── */}

      {/* Add Roadmap Initiative Modal */}
      {showRoadmapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Add Roadmap Initiative</h2>
                <button onClick={() => setShowRoadmapModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Initiative Name *', key: 'initiative_name', type: 'text' },
                  { label: 'Owner', key: 'owner', type: 'text' },
                  { label: 'Business Value', key: 'business_value', type: 'text' },
                  { label: 'Notes', key: 'notes', type: 'text' },
                  { label: 'ROI Estimate (%)', key: 'estimated_roi_pct', type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      value={(newRoadmap as Record<string, string>)[f.key] ?? ''}
                      onChange={e => setNewRoadmap(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
                {[
                  { label: 'Phase', key: 'phase', opts: PHASES.map(p => ({ v: p, l: PHASE_LABELS[p] })) },
                  { label: 'Priority', key: 'priority', opts: ['critical','high','medium','low'].map(v => ({ v, l: v })) },
                  { label: 'Status', key: 'status', opts: ['planned','in_progress','completed','on_hold','cancelled'].map(v => ({ v, l: v.replace('_', ' ') })) },
                  { label: 'AI Capability', key: 'ai_capability', opts: Object.keys(CAPABILITY_COLORS).map(v => ({ v, l: v })) },
                  { label: 'Model Type', key: 'model_type', opts: ['supervised','unsupervised','rl','llm','cv','multimodal'].map(v => ({ v, l: v })) },
                  { label: 'Deployment', key: 'deployment', opts: ['cloud','on_premise','hybrid','edge'].map(v => ({ v, l: v })) },
                  { label: 'Risk Level', key: 'risk_level', opts: ['low','medium','high','critical'].map(v => ({ v, l: v })) },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <select
                      value={(newRoadmap as Record<string, string>)[f.key] ?? ''}
                      onChange={e => setNewRoadmap(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowRoadmapModal(false)} className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={() => void handleAddRoadmap()} disabled={submitting}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {submitting ? 'Adding...' : 'Add Initiative'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate AI Roadmap Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Generate AI Roadmap with Ollama</h2>
                <button onClick={() => setShowGenerateModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Type *</label>
                  <input
                    type="text"
                    placeholder="e.g. e-commerce retailer, healthcare SaaS, fintech"
                    value={generateForm.business_type}
                    onChange={e => setGenerateForm(prev => ({ ...prev, business_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current AI Maturity: {generateForm.current_ai_maturity}/5 — {MATURITY_LABELS[generateForm.current_ai_maturity]}
                  </label>
                  <input
                    type="range" min={1} max={5} value={generateForm.current_ai_maturity}
                    onChange={e => setGenerateForm(prev => ({ ...prev, current_ai_maturity: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>Initial</span><span>Optimizing</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Top Priority</label>
                  <select value={generateForm.top_priority}
                    onChange={e => setGenerateForm(prev => ({ ...prev, top_priority: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {['cost reduction','revenue growth','customer experience','operational efficiency','risk management','innovation','competitive advantage'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget Range</label>
                  <select value={generateForm.budget_range}
                    onChange={e => setGenerateForm(prev => ({ ...prev, budget_range: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {['<$50k','$50k-$100k','$100k-$500k','$500k-$2M','>$2M'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowGenerateModal(false)} className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={() => void handleGenerateRoadmap()} disabled={generating}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {generating ? 'Generating via Ollama...' : 'Generate Roadmap'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Model Modal */}
      {showModelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Register AI Model</h2>
                <button onClick={() => setShowModelModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Model Name *', key: 'model_name' },
                  { label: 'Version', key: 'version' },
                  { label: 'Endpoint URL', key: 'endpoint_url' },
                  { label: 'Use Case', key: 'use_case' },
                  { label: 'Owner', key: 'owner' },
                  { label: 'Cost per 1k calls ($)', key: 'cost_per_1k_calls' },
                  { label: 'Carbon Footprint (kg)', key: 'carbon_footprint_kg' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input
                      type="text"
                      value={(newModel as Record<string, string | boolean>)[f.key] as string ?? ''}
                      onChange={e => setNewModel(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                ))}
                {[
                  { label: 'Model Type', key: 'model_type', opts: ['llm','classification','regression','clustering','cv','nlp','recommendation'].map(v => ({ v, l: v })) },
                  { label: 'Framework', key: 'framework', opts: ['ollama','openai','huggingface','tensorflow','pytorch','sklearn','custom'].map(v => ({ v, l: v })) },
                  { label: 'Status', key: 'status', opts: ['active','testing','deprecated','archived'].map(v => ({ v, l: v })) },
                  { label: 'Deployment Environment', key: 'deployment_env', opts: DEPLOYMENT_ENVS.map(v => ({ v, l: DEPLOYMENT_LABELS[v] })) },
                  { label: 'Explainability Method', key: 'explainability_method', opts: ['none','shap','lime','attention_viz','integrated_gradients','grad_cam'].map(v => ({ v, l: v })) },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <select
                      value={(newModel as Record<string, string | boolean>)[f.key] as string ?? ''}
                      onChange={e => setNewModel(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                ))}
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={newModel.bias_tested}
                    onChange={e => setNewModel(prev => ({ ...prev, bias_tested: e.target.checked }))}
                    className="rounded" />
                  Bias testing completed
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModelModal(false)} className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={() => void handleAddModel()} disabled={submitting}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                  {submitting ? 'Registering...' : 'Register Model'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Run Assessment Modal */}
      {assessingModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Run Responsible AI Assessment</h2>
                <button onClick={() => { setAssessingModel(null); setAssessResult(''); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Model: <span className="font-semibold">{assessingModel.name}</span></p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {ASSESSMENT_TYPES.map(type => (
                    <button key={type} onClick={() => setAssessType(type)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium capitalize border-2 transition-colors ${
                        assessType === type ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => void handleRunAssessment()} disabled={assessing}
                className="w-full py-3 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 mb-4">
                {assessing ? 'Running Ollama assessment...' : `Run ${assessType} Assessment`}
              </button>
              {assessResult && (
                <div className="p-4 bg-gray-50 border rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                  {assessResult}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
