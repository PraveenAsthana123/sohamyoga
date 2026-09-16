'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface MRProject {
  id: number; name: string; category: string; status: string; owner: string;
  description: string; targetMarket: string; geography: string; industry: string;
  tags: string; createdAt: string; scenarioCount: number; docCount: number;
}

interface MRDocument {
  id: number; projectId: number; title: string; documentType: string;
  content: string; wordCount: number; generatedBy: string; isPublished: boolean; createdAt: string;
}

interface Competitor {
  id: number; companyName: string; website: string; marketPosition: string;
  threatLevel: string; strengths: string; weaknesses: string;
  keyProducts: string; pricingModel: string; targetAudience: string; createdAt: string;
}

interface Insight {
  id: number; projectId: number; insightType: string; title: string; body: string;
  confidenceScore: number; source: string; aiGenerated: boolean; tags: string; createdAt: string;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function categoryColor(c: string) {
  const m: Record<string, string> = {
    competitor_analysis: 'bg-red-100 text-red-700', market_sizing: 'bg-blue-100 text-blue-700',
    trend_analysis: 'bg-purple-100 text-purple-700', customer_survey: 'bg-yellow-100 text-yellow-700',
    brand_audit: 'bg-pink-100 text-pink-700', pricing: 'bg-orange-100 text-orange-700',
    gap_analysis: 'bg-teal-100 text-teal-700', industry_report: 'bg-green-100 text-green-700',
  };
  return m[c] ?? 'bg-gray-100 text-gray-700';
}

function statusColor(s: string) {
  const m: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-700',
    complete: 'bg-green-100 text-green-700', archived: 'bg-gray-200 text-gray-500',
  };
  return m[s] ?? 'bg-gray-100 text-gray-600';
}

function threatColor(t: string) {
  const m: Record<string, string> = {
    low: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700',
  };
  return m[t] ?? 'bg-gray-100 text-gray-600';
}

function positionColor(p: string) {
  const m: Record<string, string> = {
    leader: 'bg-indigo-100 text-indigo-700', challenger: 'bg-blue-100 text-blue-700',
    niche: 'bg-purple-100 text-purple-700', emerging: 'bg-teal-100 text-teal-700',
  };
  return m[p] ?? 'bg-gray-100 text-gray-600';
}

function insightTypeColor(t: string) {
  const m: Record<string, string> = {
    trend: 'bg-blue-100 text-blue-700', opportunity: 'bg-green-100 text-green-700',
    threat: 'bg-red-100 text-red-700', gap: 'bg-orange-100 text-orange-700',
    benchmark: 'bg-purple-100 text-purple-700', prediction: 'bg-indigo-100 text-indigo-700',
  };
  return m[t] ?? 'bg-gray-100 text-gray-600';
}

function generatedByColor(g: string) {
  const m: Record<string, string> = {
    ai: 'bg-purple-100 text-purple-700', manual: 'bg-gray-100 text-gray-600',
    hybrid: 'bg-blue-100 text-blue-700',
  };
  return m[g?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
}

function confidenceBarColor(score: number) {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.6) return 'bg-yellow-500';
  return 'bg-red-500';
}

const CATEGORY_OPTIONS = [
  { value: 'competitor_analysis', label: 'Competitor Analysis' },
  { value: 'market_sizing', label: 'Market Sizing' },
  { value: 'trend_analysis', label: 'Trend Analysis' },
  { value: 'customer_survey', label: 'Customer Survey' },
  { value: 'brand_audit', label: 'Brand Audit' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'gap_analysis', label: 'Gap Analysis' },
  { value: 'industry_report', label: 'Industry Report' },
];

const SCENARIO_TYPES = [
  { key: 'primary_research', label: 'Primary Research', desc: 'Direct data collection via surveys, interviews, and observations.' },
  { key: 'secondary_research', label: 'Secondary Research', desc: 'Analysis of existing published data, reports, and databases.' },
  { key: 'competitive_intel', label: 'Competitive Intelligence', desc: 'Deep-dive competitor profiling, pricing, and positioning analysis.' },
  { key: 'survey_analysis', label: 'Survey Analysis', desc: 'Quantitative analysis of survey responses and statistical insights.' },
  { key: 'social_listening', label: 'Social Listening', desc: 'Real-time social media monitoring for brand and market signals.' },
  { key: 'interview_synthesis', label: 'Interview Synthesis', desc: 'Thematic synthesis of qualitative interview transcripts.' },
  { key: 'web_intelligence', label: 'Web Intelligence', desc: 'Automated web scraping, traffic data, and SEO intelligence.' },
  { key: 'ai_synthesis', label: 'AI Synthesis', desc: 'AI-powered synthesis of multiple research inputs into actionable recommendations.' },
];

const FEATURE_CATALOG = [
  {
    category: 'Research Methods',
    features: [
      { name: 'Primary Research Management', status: '✅' },
      { name: 'Secondary Research Library', status: '✅' },
      { name: 'Survey Design & Distribution', status: '⏳' },
      { name: 'Interview Recording & Transcription', status: '📋' },
      { name: 'Focus Group Management', status: '📋' },
      { name: 'Ethnographic Research Notes', status: '📋' },
    ],
  },
  {
    category: 'Data Sources',
    features: [
      { name: 'Web Intelligence / Scraping', status: '⏳' },
      { name: 'Social Media Listening', status: '⏳' },
      { name: 'Industry Report Integration', status: '✅' },
      { name: 'Government Data APIs', status: '📋' },
      { name: 'Patent & Filing Analysis', status: '📋' },
      { name: 'Job Posting Intelligence', status: '📋' },
    ],
  },
  {
    category: 'Analysis Types',
    features: [
      { name: 'SWOT Analysis Framework', status: '✅' },
      { name: "Porter's 5 Forces", status: '✅' },
      { name: 'PESTLE Analysis', status: '✅' },
      { name: 'Competitive Matrix Builder', status: '✅' },
      { name: 'TAM / SAM / SOM Sizing', status: '✅' },
      { name: 'Price Elasticity Modeling', status: '⏳' },
      { name: 'Conjoint Analysis', status: '📋' },
      { name: 'Sentiment Analysis', status: '⏳' },
    ],
  },
  {
    category: 'Output Formats',
    features: [
      { name: 'Executive Short Reports (400-600w)', status: '✅' },
      { name: 'Detailed Reports (1500-2000w)', status: '✅' },
      { name: 'Excel / Data Exports', status: '⏳' },
      { name: 'Presentation Decks', status: '📋' },
      { name: 'Interactive Dashboards', status: '⏳' },
      { name: 'PDF Export', status: '📋' },
    ],
  },
  {
    category: 'AI Capabilities',
    features: [
      { name: 'AI Report Generation (Ollama)', status: '✅' },
      { name: 'AI Insight Generation', status: '✅' },
      { name: 'AI Competitor Profiling', status: '⏳' },
      { name: 'AI Trend Detection', status: '⏳' },
      { name: 'AI Summary & TL;DR', status: '⏳' },
      { name: 'AI Question Suggestion', status: '📋' },
      { name: 'Multi-model Synthesis', status: '📋' },
    ],
  },
  {
    category: 'Collaboration',
    features: [
      { name: 'Project Ownership & Assignment', status: '✅' },
      { name: 'Team Comments & Notes', status: '📋' },
      { name: 'Review & Approval Workflow', status: '📋' },
      { name: 'Version History', status: '⏳' },
      { name: 'Shared Document Links', status: '📋' },
    ],
  },
  {
    category: 'Delivery',
    features: [
      { name: 'Document Storage', status: '✅' },
      { name: 'Project Status Tracking', status: '✅' },
      { name: 'Scheduled Research Runs', status: '📋' },
      { name: 'Email Delivery of Reports', status: '📋' },
      { name: 'Slack / Teams Notifications', status: '📋' },
    ],
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MarketResearchPage() {
  const [tab, setTab] = useState(0);
  const [seeded, setSeeded] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/market-research/seed')
      .then(r => r.json())
      .then((d: { ok?: boolean; message?: string }) => { if (d.ok) setSeeded(true); setSeedMsg(d.message ?? ''); })
      .catch(() => {});
  }, []);

  const tabs = [
    'Projects', 'Research Scenarios', 'Document Delivery',
    'Short Reports', 'Detailed Reports', 'Competitor Analysis',
    'Market Insights', 'Feature Catalog',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Market Research</h1>
          <p className="text-sm text-gray-500 mt-0.5">Competitive intelligence, market sizing, trend analysis and AI-powered reports</p>
          {seedMsg && <p className="text-xs text-green-600 mt-1">{seedMsg}</p>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0 overflow-x-auto">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {!seeded && <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">Initializing database…</div>}
        {tab === 0 && <TabProjects />}
        {tab === 1 && <TabScenarios />}
        {tab === 2 && <TabDocuments />}
        {tab === 3 && <TabShortReports />}
        {tab === 4 && <TabDetailedReports />}
        {tab === 5 && <TabCompetitors />}
        {tab === 6 && <TabInsights />}
        {tab === 7 && <TabFeatureCatalog />}
      </div>
    </div>
  );
}

// ── Tab 1: Projects ───────────────────────────────────────────────────────────

function TabProjects() {
  const [projects, setProjects] = useState<MRProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'market_sizing', description: '', target_market: '', geography: '', industry: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/market-research/projects')
      .then(r => r.json())
      .then((d: { projects?: MRProject[] }) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = projects.length;
  const inProgress = projects.filter(p => p.status === 'in_progress').length;
  const complete = projects.filter(p => p.status === 'complete').length;
  const aiDocs = projects.reduce((s, p) => s + p.docCount, 0);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/admin/market-research/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) throw new Error('Failed');
      setMsg('Project created!'); setShowForm(false);
      setForm({ name: '', category: 'market_sizing', description: '', target_market: '', geography: '', industry: '' });
      load();
    } catch { setMsg('Error creating project.'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this project?')) return;
    await fetch(`/api/admin/market-research/projects/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Projects', value: total, color: 'text-gray-900' },
          { label: 'In Progress', value: inProgress, color: 'text-blue-600' },
          { label: 'Complete', value: complete, color: 'text-green-600' },
          { label: 'Total Docs', value: aiDocs, color: 'text-purple-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className={`text-3xl font-bold ${k.color}`}>{loading ? '…' : k.value}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Header + button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Research Projects</h2>
        <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          + New Project
        </button>
      </div>

      {msg && <p className="text-sm text-green-600">{msg}</p>}

      {/* New project form */}
      {showForm && (
        <div className="bg-white border border-indigo-200 rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">New Research Project</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Project Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. Canada Yoga Market 2026" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Target Market</label>
              <input value={form.target_market} onChange={e => setForm(f => ({ ...f, target_market: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Geography</label>
              <input value={form.geography} onChange={e => setForm(f => ({ ...f, geography: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. Canada" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Industry</label>
              <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Project'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Project cards */}
      {loading ? <div className="text-center py-12 text-gray-400">Loading projects…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">{p.name}</h3>
                <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(p.category)}`}>
                  {p.category.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{p.status.replace(/_/g, ' ')}</span>
                <span className="text-xs text-gray-400">{p.scenarioCount} scenarios · {p.docCount} docs</span>
              </div>
              <div className="text-xs text-gray-400">{p.geography} · {p.industry}</div>
              <div className="flex gap-2 pt-1">
                <button className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100">View</button>
                <GenerateReportBtn projectId={p.id} />
                <button onClick={() => handleDelete(p.id)} className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">Delete</button>
              </div>
            </div>
          ))}
          {projects.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">No projects yet. Create one above.</div>}
        </div>
      )}
    </div>
  );
}

function GenerateReportBtn({ projectId }: { projectId: number }) {
  const [running, setRunning] = useState(false);
  const handleGenerate = async () => {
    setRunning(true);
    try {
      await fetch('/api/admin/market-research/generate-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, report_type: 'short' }),
      });
      alert('Report generated — check Document Delivery tab.');
    } finally { setRunning(false); }
  };
  return (
    <button onClick={handleGenerate} disabled={running}
      className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 disabled:opacity-50">
      {running ? 'Generating…' : 'Gen Report'}
    </button>
  );
}

// ── Tab 2: Research Scenarios ─────────────────────────────────────────────────

function TabScenarios() {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [projects, setProjects] = useState<MRProject[]>([]);
  const [form, setForm] = useState({ name: '', description: '', data_sources: '', output_format: 'short_report', project_id: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/market-research/projects')
      .then(r => r.json())
      .then((d: { projects?: MRProject[] }) => setProjects(d.projects ?? []));
  }, []);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.project_id) { setMsg('Name and project are required.'); return; }
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/admin/market-research/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, resource: 'scenario' }),
      });
      if (!r.ok) throw new Error('Failed');
      setMsg('Scenario added!'); setActiveScenario(null);
      setForm({ name: '', description: '', data_sources: '', output_format: 'short_report', project_id: '' });
    } catch { setMsg('Error adding scenario.'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Research Scenario Types</h2>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SCENARIO_TYPES.map(s => (
          <div key={s.key} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">{s.label}</h3>
            <p className="text-xs text-gray-500">{s.desc}</p>
            <button onClick={() => setActiveScenario(activeScenario === s.key ? null : s.key)}
              className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 w-full">
              {activeScenario === s.key ? 'Close' : 'Add Scenario'}
            </button>
            {activeScenario === s.key && (
              <div className="space-y-2 border-t pt-3">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Scenario name *" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description" rows={2} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                <input value={form.data_sources} onChange={e => setForm(f => ({ ...f, data_sources: e.target.value }))}
                  placeholder="Data sources (comma separated)" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                <select value={form.output_format} onChange={e => setForm(f => ({ ...f, output_format: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs">
                  <option value="short_report">Short Report</option>
                  <option value="detailed_report">Detailed Report</option>
                  <option value="excel">Excel</option>
                  <option value="presentation">Presentation</option>
                </select>
                <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs">
                  <option value="">Select project *</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={handleAdd} disabled={saving}
                  className="w-full text-xs py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add Scenario'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab 3: Document Delivery ──────────────────────────────────────────────────

function TabDocuments() {
  const [projects, setProjects] = useState<MRProject[]>([]);
  const [docs, setDocs] = useState<MRDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selProject, setSelProject] = useState('');
  const [reportType, setReportType] = useState<'short' | 'detailed'>('short');
  const [focus, setFocus] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [genTime, setGenTime] = useState(0);
  const [genWordCount, setGenWordCount] = useState(0);

  useEffect(() => {
    fetch('/api/admin/market-research/projects')
      .then(r => r.json())
      .then((d: { projects?: MRProject[]; documents?: MRDocument[] }) => {
        setProjects(d.projects ?? []);
        if (d.documents) setDocs(d.documents);
        setLoading(false);
      });
  }, []);

  const handleGenerate = async () => {
    if (!selProject) return;
    setGenerating(true); setGeneratedContent(''); setGenTime(0); setGenWordCount(0);
    const start = Date.now();
    try {
      const r = await fetch('/api/admin/market-research/generate-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: Number(selProject), report_type: reportType, focus }),
      });
      const d = await r.json() as { content?: string; wordCount?: number; error?: string };
      if (!r.ok) throw new Error(d.error ?? 'Failed');
      const content = d.content ?? '';
      setGeneratedContent(content);
      setGenWordCount(d.wordCount ?? content.split(/\s+/).filter(Boolean).length);
      setGenTime(Math.round((Date.now() - start) / 1000));
    } catch (e) { setGeneratedContent(`Error: ${String(e)}`); } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
          {loading ? <div className="text-gray-400 text-sm">Loading…</div> : docs.length === 0 ? (
            <div className="text-gray-400 text-sm py-8 text-center">Generate a report to see documents here.</div>
          ) : (
            <div className="space-y-3">
              {docs.map(doc => (
                <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{doc.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{doc.documentType?.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-gray-400">{doc.wordCount ?? 0} words</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${generatedByColor(doc.generatedBy)}`}>{doc.generatedBy}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${doc.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {doc.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generate panel */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 self-start">
          <h3 className="font-semibold text-gray-900">Generate Report</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
            <select value={selProject} onChange={e => setSelProject(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="">Select project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as 'short' | 'detailed')} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="short">Short Report (400–600w)</option>
              <option value="detailed">Detailed Report (1500–2000w)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Focus / Additional Context</label>
            <textarea value={focus} onChange={e => setFocus(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. Focus on pricing strategy and competitive positioning" />
          </div>
          <button onClick={handleGenerate} disabled={generating || !selProject}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
            {generating ? 'Generating with AI…' : 'Generate with AI'}
          </button>
          {generatedContent && (
            <div className="space-y-2">
              <div className="flex gap-3 text-xs text-gray-500">
                <span>{genWordCount} words</span>
                <span>{genTime}s generation time</span>
              </div>
              <textarea value={generatedContent} readOnly rows={10}
                className="w-full border border-gray-200 rounded px-3 py-2 text-xs font-mono bg-gray-50" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab 4: Short Reports ──────────────────────────────────────────────────────

function TabShortReports() {
  const [projects, setProjects] = useState<MRProject[]>([]);
  const [selProject, setSelProject] = useState('');
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    fetch('/api/admin/market-research/projects').then(r => r.json())
      .then((d: { projects?: MRProject[] }) => setProjects(d.projects ?? []));
  }, []);

  const handleQuickGen = async () => {
    if (!selProject) return;
    setGenerating(true); setResult('');
    try {
      const r = await fetch('/api/admin/market-research/generate-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: Number(selProject), report_type: 'short', focus: topic }),
      });
      const d = await r.json() as { content?: string; error?: string };
      setResult(d.content ?? d.error ?? 'Error');
    } catch (e) { setResult(String(e)); } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Short Reports (400–600 words)</h2>
      </div>
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5 space-y-4">
        <h3 className="font-semibold text-indigo-900 text-sm">Quick Generate Short Report</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
            <select value={selProject} onChange={e => setSelProject(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white">
              <option value="">Select project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Topic / Focus</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white" placeholder="e.g. Pricing strategy" />
          </div>
        </div>
        <button onClick={handleQuickGen} disabled={generating || !selProject}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
          {generating ? 'Generating…' : 'Generate Short Report'}
        </button>
        {result && <textarea value={result} readOnly rows={8} className="w-full border border-gray-200 rounded px-3 py-2 text-xs font-mono bg-white" />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {projects.filter(p => p.docCount > 0).map(p => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900 text-sm">{p.name} — Short Report</div>
                <div className="text-xs text-gray-500 mt-1">{p.category.replace(/_/g, ' ')} · {p.geography}</div>
              </div>
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">AI</span>
            </div>
          </div>
        ))}
        {projects.filter(p => p.docCount > 0).length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-400 text-sm">No short reports yet. Generate one above.</div>
        )}
      </div>
    </div>
  );
}

// ── Tab 5: Detailed Reports ───────────────────────────────────────────────────

function TabDetailedReports() {
  const [projects, setProjects] = useState<MRProject[]>([]);
  const [selProject, setSelProject] = useState('');
  const [section, setSection] = useState('');
  const [expanding, setExpanding] = useState(false);
  const [expandResult, setExpandResult] = useState('');

  useEffect(() => {
    fetch('/api/admin/market-research/projects').then(r => r.json())
      .then((d: { projects?: MRProject[] }) => setProjects(d.projects ?? []));
  }, []);

  const handleExpand = async () => {
    if (!selProject || !section) return;
    setExpanding(true); setExpandResult('');
    const selectedProject = projects.find(p => String(p.id) === selProject);
    try {
      const r = await fetch('/api/admin/market-research/generate-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: Number(selProject), report_type: 'detailed', focus: `Expand this section: ${section}. Project context: ${selectedProject?.description ?? ''}` }),
      });
      const d = await r.json() as { content?: string; error?: string };
      setExpandResult(d.content ?? d.error ?? 'Error');
    } catch (e) { setExpandResult(String(e)); } finally { setExpanding(false); }
  };

  const toc = ['1. Executive Summary', '2. Market Overview & Size', '3. Competitive Landscape',
    '4. Customer Segmentation', '5. Trend Analysis', '6. SWOT Analysis',
    '7. Growth Opportunities', '8. Risk Factors', '9. Strategic Recommendations', '10. Appendix'];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Detailed Reports (1500–2000 words)</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {projects.filter(p => p.docCount > 0).map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="font-medium text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-500 mt-1 mb-3">{p.category.replace(/_/g, ' ')} · {p.industry}</div>
              <div className="text-xs font-medium text-gray-700 mb-2">Table of Contents</div>
              <div className="space-y-1">
                {toc.map(item => (
                  <div key={item} className="text-xs text-gray-600 py-1 px-2 bg-gray-50 rounded hover:bg-indigo-50 cursor-pointer"
                    onClick={() => setSection(item)}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {projects.filter(p => p.docCount > 0).length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No detailed reports yet.</div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 self-start">
          <h3 className="font-semibold text-gray-900 text-sm">AI Expand Section</h3>
          <select value={selProject} onChange={e => setSelProject(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">Select project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input value={section} onChange={e => setSection(e.target.value)} placeholder="Section name / click from ToC"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          <button onClick={handleExpand} disabled={expanding || !selProject || !section}
            className="w-full py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50">
            {expanding ? 'Expanding…' : 'Expand Section'}
          </button>
          {expandResult && <textarea value={expandResult} readOnly rows={10} className="w-full border border-gray-200 rounded px-2 py-2 text-xs font-mono bg-gray-50" />}
        </div>
      </div>
    </div>
  );
}

// ── Tab 6: Competitor Analysis ────────────────────────────────────────────────

function TabCompetitors() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    company_name: '', website: '', market_position: 'challenger', threat_level: 'medium',
    strengths: '', weaknesses: '', key_products: '', pricing_model: '', target_audience: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/market-research/competitor-analysis')
      .then(r => r.json())
      .then((d: { competitors?: Competitor[] }) => setCompetitors(d.competitors ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = competitors.length;
  const highThreat = competitors.filter(c => c.threatLevel === 'high' || c.threatLevel === 'critical').length;
  const leaders = competitors.filter(c => c.marketPosition === 'leader').length;

  const handleAdd = async () => {
    if (!form.company_name.trim()) { setMsg('Company name required.'); return; }
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/admin/market-research/competitor-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error('Failed');
      setMsg('Competitor added!'); setShowModal(false);
      setForm({ company_name: '', website: '', market_position: 'challenger', threat_level: 'medium', strengths: '', weaknesses: '', key_products: '', pricing_model: '', target_audience: '' });
      load();
    } catch { setMsg('Error adding competitor.'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Competitors', value: total },
          { label: 'High / Critical Threat', value: highThreat },
          { label: 'Market Leaders', value: leaders },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-3xl font-bold text-gray-900">{loading ? '…' : k.value}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Competitor Database</h2>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          + Add Competitor
        </button>
      </div>

      {msg && <p className="text-sm text-green-600">{msg}</p>}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg space-y-4 max-h-screen overflow-y-auto">
            <h3 className="font-semibold text-gray-900">Add Competitor</h3>
            {([
              { label: 'Company Name *', key: 'company_name', placeholder: 'e.g. Mindbody' },
              { label: 'Website', key: 'website', placeholder: 'mindbody.io' },
              { label: 'Key Products', key: 'key_products', placeholder: 'Studio management, client app…' },
              { label: 'Pricing Model', key: 'pricing_model', placeholder: '$139-$599/month' },
              { label: 'Target Audience', key: 'target_audience', placeholder: 'Yoga studio owners…' },
            ] as Array<{ label: string; key: keyof typeof form; placeholder: string }>).map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input value={form[f.key]} onChange={e => setForm(frm => ({ ...frm, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Market Position</label>
                <select value={form.market_position} onChange={e => setForm(f => ({ ...f, market_position: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="leader">Leader</option><option value="challenger">Challenger</option>
                  <option value="niche">Niche</option><option value="emerging">Emerging</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Threat Level</label>
                <select value={form.threat_level} onChange={e => setForm(f => ({ ...f, threat_level: e.target.value }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="low">Low</option><option value="medium">Medium</option>
                  <option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Strengths</label>
              <textarea value={form.strengths} onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Weaknesses</label>
              <textarea value={form.weaknesses} onChange={e => setForm(f => ({ ...f, weaknesses: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Competitor'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Company', 'Position', 'Threat', 'Strengths', 'Weaknesses', 'Pricing'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitors.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.companyName}</div>
                    <div className="text-xs text-gray-400">{c.website}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${positionColor(c.marketPosition)}`}>{c.marketPosition}</span></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${threatColor(c.threatLevel)}`}>{c.threatLevel}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{c.strengths}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{c.weaknesses}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.pricingModel}</td>
                </tr>
              ))}
              {competitors.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No competitors yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 7: Market Insights ────────────────────────────────────────────────────

function TabInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [projects, setProjects] = useState<MRProject[]>([]);
  const [selProject, setSelProject] = useState('');
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const url = typeFilter ? `/api/admin/market-research/insights?type=${typeFilter}` : '/api/admin/market-research/insights';
    fetch(url).then(r => r.json())
      .then((d: { insights?: Insight[] }) => setInsights(d.insights ?? []))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/admin/market-research/projects').then(r => r.json())
      .then((d: { projects?: MRProject[] }) => setProjects(d.projects ?? []));
  }, []);

  const handleGenerate = async () => {
    if (!selProject) { setMsg('Select a project first.'); return; }
    setGenerating(true); setMsg('');
    try {
      const r = await fetch('/api/admin/market-research/insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: Number(selProject), generate: true }),
      });
      const d = await r.json() as { count?: number; error?: string };
      if (!r.ok) throw new Error(d.error ?? 'Failed');
      setMsg(`Generated ${d.count ?? 5} insights!`); load();
    } catch (e) { setMsg(String(e)); } finally { setGenerating(false); }
  };

  const types = ['trend', 'opportunity', 'threat', 'gap', 'benchmark', 'prediction'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTypeFilter('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full ${!typeFilter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All
          </button>
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full ${typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <select value={selProject} onChange={e => setSelProject(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm">
            <option value="">Select project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={handleGenerate} disabled={generating || !selProject}
            className="px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50">
            {generating ? 'Generating…' : 'Generate 5 Insights'}
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-green-600">{msg}</p>}

      {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map(ins => (
            <div key={ins.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">{ins.title}</h3>
                <div className="flex gap-1 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${insightTypeColor(ins.insightType)}`}>{ins.insightType}</span>
                  {ins.aiGenerated && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">AI</span>}
                </div>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{ins.body}</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Confidence</span>
                  <span>{Math.round((ins.confidenceScore ?? 0) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${confidenceBarColor(ins.confidenceScore ?? 0)}`}
                    style={{ width: `${(ins.confidenceScore ?? 0) * 100}%` }} />
                </div>
              </div>
              <div className="text-xs text-gray-400">Source: {ins.source}</div>
            </div>
          ))}
          {insights.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">No insights yet. Generate some above.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 8: Feature Catalog ────────────────────────────────────────────────────

function TabFeatureCatalog() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Market Research Feature Catalog</h2>
        <div className="flex gap-4 text-xs text-gray-500">
          <span>✅ Built</span><span>⏳ In Progress</span><span>📋 Planned</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURE_CATALOG.map(cat => (
          <div key={cat.category} className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">{cat.category}</h3>
            <div className="space-y-2">
              {cat.features.map(f => (
                <div key={f.name} className="flex items-center gap-2 text-sm">
                  <span className="text-base leading-none">{f.status}</span>
                  <span className={`text-xs ${f.status === '✅' ? 'text-gray-900' : f.status === '⏳' ? 'text-gray-600' : 'text-gray-400'}`}>{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
