'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskModelInfo {
  task_type: string;
  preferred_models: string[];
  selected_model: string | null;
  available: boolean;
}

interface Stats {
  models_online: number;
  tasks_today: number;
  routes_using_dispatcher: number;
  routes_using_raw_llama: number;
}

interface StrategyData {
  task_model_mapping: TaskModelInfo[];
  stats: Stats;
}

interface FleetModel {
  name: string;
  size_bytes: number;
  parameter_size: string;
  family: string;
  task_types: string[];
}

interface FleetData {
  groups: Record<string, FleetModel[]>;
  total: number;
}

interface TestResult {
  model_used: string;
  latency_ms: number;
  output: string;
  online: boolean;
  task_type: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_TASK_TYPES = [
  'text_generation', 'code_generation', 'code_review', 'summarization',
  'classification', 'entity_extraction', 'sentiment_analysis', 'translation',
  'reasoning', 'planning', 'tool_use', 'content_safety', 'embedding',
  'qa', 'marketing_copy', 'email_draft', 'seo_analysis', 'data_analysis',
] as const;

type TaskType = typeof ALL_TASK_TYPES[number];

const TASK_EXAMPLE_PROMPTS: Record<TaskType, string> = {
  text_generation:    'Write a short paragraph introducing our yoga wellness platform.',
  code_generation:    'Write a TypeScript function that validates an email address.',
  code_review:        'Review this code: function add(a,b){return a+b} — is it production-ready?',
  summarization:      'Summarize: Yoga improves flexibility, reduces stress, and promotes mindfulness through physical postures, breathing exercises, and meditation.',
  classification:     'Classify this customer message: "I love the morning yoga classes, they start my day perfectly!"',
  entity_extraction:  'Extract entities from: "John Smith booked a 60-minute session with instructor Maya Patel on Tuesday at 9am."',
  sentiment_analysis: 'Analyze sentiment: "The new studio location is amazing but the parking is terrible."',
  translation:        'Translate to Spanish: "Welcome to our yoga wellness community. We offer daily classes for all levels."',
  reasoning:          'A yoga studio has 10 instructors. Each teaches 3 classes/week. Each class has 15 students. How many student-sessions per week?',
  planning:           'Create a 4-week beginner yoga program plan with 3 sessions per week.',
  tool_use:           'I need to schedule a yoga class for next Monday at 10am. What steps should I take?',
  content_safety:     'Check this user-submitted review for policy violations: "The instructor was absolutely amazing and very professional."',
  embedding:          'Generate an embedding vector concept for: "morning hatha yoga flow for beginners"',
  qa:                 'Q: What are the benefits of practicing yoga daily? A:',
  marketing_copy:     'Write compelling ad copy for a 30-day yoga challenge starting in January.',
  email_draft:        'Draft a welcome email for a new yoga studio member who just signed up for their first class.',
  seo_analysis:       'Analyze SEO for the keyword "beginner yoga classes near me" — what content should we create?',
  data_analysis:      'Our yoga studio has 500 members. 60% attend 1x/week, 30% attend 2x/week, 10% attend 3x/week. What is the average weekly attendance per member?',
};

const MODEL_SIZE_MAP: Record<string, string> = {
  'qwen3:8b': '8B', 'llama3.1:8b': '8B', 'mistral:latest': '7B',
  'llama3:latest': '8B', 'qwen2.5-coder:latest': '7B', 'deepseek-coder-v2:latest': '16B',
  'qwen2.5-coder:14b': '14B', 'codegemma:7b': '7B', 'code-reviewer:latest': '7B',
  'qwen2.5:latest': '7B', 'gemma3:4b': '4B', 'gemma2:9b': '9B',
  'deepseek-r1:8b': '8B', 'phi4:14b': '14B', 'llama3-groq-tool-use:latest': '8B',
  'llama-guard3:latest': '8B', 'shieldgemma:9b': '9B', 'nomic-embed-text:latest': '137M',
  'mxbai-embed-large:latest': '335M', 'bge-m3:latest': '570M',
};

const MODEL_WHY_MAP: Record<string, string> = {
  'qwen3:8b': 'Excellent general-purpose reasoning, fast',
  'llama3.1:8b': 'Meta flagship, strong instruction following',
  'mistral:latest': 'Efficient 7B, great for structured tasks',
  'qwen2.5-coder:latest': 'Best-in-class code generation',
  'deepseek-coder-v2:latest': 'Strong code reasoning and review',
  'code-reviewer:latest': 'Fine-tuned specifically for code review',
  'qwen2.5:latest': 'Excellent for creative and marketing text',
  'deepseek-r1:8b': 'Chain-of-thought reasoning specialist',
  'phi4:14b': 'Microsoft reasoning model, very accurate',
  'llama3-groq-tool-use:latest': 'Optimised for function/tool calling',
  'llama-guard3:latest': 'Meta safety classifier, purpose-built',
  'shieldgemma:9b': 'Google safety model, comprehensive',
  'nomic-embed-text:latest': 'Fast embeddings, 8192 ctx, open',
  'mxbai-embed-large:latest': 'High-quality large embeddings',
  'bge-m3:latest': 'Multi-lingual, multi-granularity embeddings',
  'gemma3:4b': 'Lightweight, good classification',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ background: '#1a1a2e', border: `1px solid ${color}`, borderRadius: 8, padding: '16px 20px', minWidth: 160 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function PipelineBox({ label, sub, color, arrow }: { label: string; sub?: string; color: string; arrow?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        border: `2px solid ${color}`, borderRadius: 8, padding: '10px 20px',
        background: '#0d1117', textAlign: 'center', minWidth: 200,
      }}>
        <div style={{ fontWeight: 700, color }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{sub}</div>}
      </div>
      {arrow && <div style={{ color: '#555', fontSize: 24, lineHeight: '28px' }}>↓</div>}
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function OllamaStrategyPage() {
  const [activeTab, setActiveTab] = useState<'strategy' | 'test' | 'migration' | 'fleet' | 'policy'>('strategy');
  const [data, setData] = useState<StrategyData | null>(null);
  const [fleet, setFleet] = useState<FleetData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingFleet, setLoadingFleet] = useState(false);

  // Live Test state
  const [testTaskType, setTestTaskType] = useState<TaskType>('text_generation');
  const [testPrompt, setTestPrompt] = useState(TASK_EXAMPLE_PROMPTS.text_generation);
  const [testTemp, setTestTemp] = useState(0.7);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState('');

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch('/api/admin/ollama-strategy');
      const json = await res.json() as StrategyData;
      setData(json);
    } catch {
      /* ignore */
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadFleet = useCallback(async () => {
    if (fleet) return;
    setLoadingFleet(true);
    try {
      const res = await fetch('/api/admin/ollama-strategy?action=fleet');
      const json = await res.json() as FleetData;
      setFleet(json);
    } catch {
      /* ignore */
    } finally {
      setLoadingFleet(false);
    }
  }, [fleet]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (activeTab === 'fleet') void loadFleet();
  }, [activeTab, loadFleet]);

  const handleTaskTypeChange = (tt: TaskType) => {
    setTestTaskType(tt);
    setTestPrompt(TASK_EXAMPLE_PROMPTS[tt]);
    setTestResult(null);
    setTestError('');
  };

  const runTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    setTestError('');
    try {
      const res = await fetch('/api/admin/ollama-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_type: testTaskType, prompt: testPrompt, temperature: testTemp }),
      });
      const json = await res.json() as TestResult & { error?: string };
      if (json.error) { setTestError(json.error); }
      else { setTestResult(json); }
    } catch (e) {
      setTestError(String(e));
    } finally {
      setTestLoading(false);
    }
  };

  const stats = data?.stats;

  const TABS: { id: typeof activeTab; label: string }[] = [
    { id: 'strategy', label: 'Strategy Map' },
    { id: 'test', label: 'Live Test' },
    { id: 'migration', label: 'Migration Status' },
    { id: 'fleet', label: 'Model Fleet' },
    { id: 'policy', label: 'Policy' },
  ];

  return (
    <div style={{ padding: '24px', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed', margin: 0 }}>
          Ollama-First Strategy
        </h1>
        <p style={{ color: '#888', marginTop: 6, fontSize: 14 }}>
          All AI tasks route through local Ollama models — right model per task, cloud only as fallback.
        </p>
      </div>

      {/* Stats Row */}
      {loadingData ? (
        <div style={{ color: '#555', marginBottom: 24 }}>Loading stats…</div>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <StatCard label="Models Online" value={stats?.models_online ?? 0} color="#22c55e" />
          <StatCard label="Routes Using Dispatcher" value={stats?.routes_using_dispatcher ?? 0} color="#7c3aed" />
          <StatCard label="Routes Using Raw llama3.2" value={stats?.routes_using_raw_llama ?? 0} color="#f59e0b" />
          <StatCard label="Tasks Run Today" value={stats?.tasks_today ?? 0} color="#38bdf8" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #333', marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: 14, fontWeight: 600,
              color: activeTab === t.id ? '#7c3aed' : '#888',
              borderBottom: activeTab === t.id ? '2px solid #7c3aed' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Strategy Map ──────────────────────────────────────────────────────── */}
      {activeTab === 'strategy' && (
        <div>
          {/* Pipeline Diagram */}
          <div style={{ marginBottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', marginBottom: 20 }}>
              Ollama-First Routing Pipeline
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              <PipelineBox label="User Request" color="#38bdf8" arrow />
              <PipelineBox label="Task Type Classifier" sub="detect what kind of AI task this is" color="#a78bfa" arrow />
              <PipelineBox label="Model Selector" sub="pick best Ollama model for task type" color="#a78bfa" arrow />
              <PipelineBox label="Ollama First" sub="try http://localhost:11434" color="#22c55e" />
              <div style={{ display: 'flex', gap: 32, marginTop: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ color: '#555', fontSize: 13 }}>├─ SUCCESS</div>
                  <div style={{ border: '2px solid #22c55e', borderRadius: 8, padding: '8px 16px', background: '#0d2d1a', color: '#22c55e', fontWeight: 600, fontSize: 13 }}>
                    return result ✓
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ color: '#555', fontSize: 13 }}>└─ OFFLINE/FAIL</div>
                  <div style={{ color: '#555', fontSize: 20 }}>↓</div>
                  <div style={{ border: '2px solid #f59e0b', borderRadius: 8, padding: '8px 16px', background: '#1c1200', color: '#f59e0b', fontWeight: 600, fontSize: 13 }}>
                    Cloud Fallback
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4, textAlign: 'center' }}>
                    OpenAI / HuggingFace / Anthropic
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Task Type Table */}
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', marginBottom: 12 }}>
            Task Type → Model Assignment (18 task types)
          </h2>
          {loadingData ? (
            <div style={{ color: '#555' }}>Loading…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    {['Task Type', 'Assigned Model', 'Model Size', 'Why This Model', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.task_model_mapping ?? []).map(row => (
                    <tr key={row.task_type} style={{ borderBottom: '1px solid #1e1e2e' }}>
                      <td style={{ padding: '8px 12px', color: '#a78bfa', fontFamily: 'monospace' }}>{row.task_type}</td>
                      <td style={{ padding: '8px 12px', color: '#e0e0e0', fontFamily: 'monospace', fontSize: 12 }}>
                        {row.selected_model ?? <span style={{ color: '#555' }}>none</span>}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#888' }}>
                        {row.selected_model ? (MODEL_SIZE_MAP[row.selected_model] ?? '?') : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#ccc', maxWidth: 260, fontSize: 12 }}>
                        {row.selected_model ? (MODEL_WHY_MAP[row.selected_model] ?? row.preferred_models[0]) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {row.available
                          ? <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                              live
                            </span>
                          : <span style={{ color: '#f87171' }}>offline</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Live Test ─────────────────────────────────────────────────────────── */}
      {activeTab === 'test' && (
        <div style={{ maxWidth: 700 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', marginBottom: 20 }}>
            Live Test — Ollama-First Strategy
          </h2>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#888', fontSize: 13, marginBottom: 6 }}>Task Type</label>
            <select
              value={testTaskType}
              onChange={e => handleTaskTypeChange(e.target.value as TaskType)}
              style={{ background: '#1a1a2e', color: '#e0e0e0', border: '1px solid #333', borderRadius: 6, padding: '8px 12px', fontSize: 14, width: '100%' }}
            >
              {ALL_TASK_TYPES.map(tt => (
                <option key={tt} value={tt}>{tt}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#888', fontSize: 13, marginBottom: 6 }}>Test Prompt</label>
            <textarea
              value={testPrompt}
              onChange={e => setTestPrompt(e.target.value)}
              rows={4}
              style={{ background: '#1a1a2e', color: '#e0e0e0', border: '1px solid #333', borderRadius: 6, padding: '8px 12px', fontSize: 13, width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: '#888', fontSize: 13, marginBottom: 6 }}>
              Temperature: <span style={{ color: '#a78bfa' }}>{testTemp.toFixed(1)}</span>
            </label>
            <input
              type="range" min={0} max={1} step={0.1} value={testTemp}
              onChange={e => setTestTemp(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555' }}>
              <span>0.0 (deterministic)</span>
              <span>1.0 (creative)</span>
            </div>
          </div>

          <button
            onClick={() => void runTest()}
            disabled={testLoading || !testPrompt.trim()}
            style={{
              background: testLoading ? '#333' : '#7c3aed', color: '#fff', border: 'none',
              borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 600,
              cursor: testLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {testLoading ? 'Running…' : 'Run via Ollama-First Strategy'}
          </button>

          {testError && (
            <div style={{ marginTop: 20, background: '#1c0a0a', border: '1px solid #f87171', borderRadius: 6, padding: 12, color: '#f87171', fontSize: 13 }}>
              Error: {testError}
            </div>
          )}

          {testResult && (
            <div style={{ marginTop: 20, background: '#0d1117', border: '1px solid #333', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ color: '#888', fontSize: 12 }}>Model Selected</span>
                  <div style={{ color: '#a78bfa', fontFamily: 'monospace', fontWeight: 600 }}>{testResult.model_used}</div>
                </div>
                <div>
                  <span style={{ color: '#888', fontSize: 12 }}>Latency</span>
                  <div style={{ color: '#38bdf8', fontWeight: 600 }}>{testResult.latency_ms.toLocaleString()} ms</div>
                </div>
                <div>
                  <span style={{ color: '#888', fontSize: 12 }}>Status</span>
                  <div style={{ color: testResult.online ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                    {testResult.online ? 'Ollama — online' : 'Fallback — offline'}
                  </div>
                </div>
              </div>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>Response</div>
              <div style={{ background: '#0a0a14', borderRadius: 6, padding: 12, color: '#e0e0e0', fontSize: 13, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto' }}>
                {testResult.output}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Migration Status ──────────────────────────────────────────────────── */}
      {activeTab === 'migration' && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', marginBottom: 8 }}>
            Migration Status: Raw llama3.2 → Dispatcher
          </h2>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
            413 routes currently call Ollama directly with hardcoded <code style={{ color: '#f59e0b' }}>model: &apos;llama3.2&apos;</code>.
            Target: all routes use <code style={{ color: '#a78bfa' }}>dispatchToOllama()</code> or <code style={{ color: '#a78bfa' }}>ollamaFirst()</code>.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  {['Module / Route', 'Current Model', 'Target Task Type', 'Target Model', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MIGRATION_ROWS.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1e1e2e' }}>
                    <td style={{ padding: '8px 12px', color: '#e0e0e0', fontFamily: 'monospace', fontSize: 12 }}>{row.module}</td>
                    <td style={{ padding: '8px 12px', color: '#f87171', fontFamily: 'monospace', fontSize: 12 }}>{row.current}</td>
                    <td style={{ padding: '8px 12px', color: '#a78bfa', fontFamily: 'monospace', fontSize: 12 }}>{row.taskType}</td>
                    <td style={{ padding: '8px 12px', color: '#22c55e', fontFamily: 'monospace', fontSize: 12 }}>{row.target}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {row.status === 'migrated'
                        ? <span style={{ background: '#0d2d1a', color: '#22c55e', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>migrated</span>
                        : <span style={{ background: '#1c1200', color: '#f59e0b', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>pending</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16, color: '#555', fontSize: 13 }}>
            Showing 20 representative modules. Full migration tracked via codebase grep on <code style={{ color: '#888' }}>model: &apos;llama3.2&apos;</code>.
          </div>
        </div>
      )}

      {/* ── Model Fleet ───────────────────────────────────────────────────────── */}
      {activeTab === 'fleet' && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', marginBottom: 20 }}>
            Model Fleet {fleet ? `(${fleet.total} models available)` : ''}
          </h2>
          {loadingFleet ? (
            <div style={{ color: '#555' }}>Fetching from Ollama /api/tags…</div>
          ) : !fleet ? (
            <div style={{ color: '#f87171' }}>Could not fetch fleet data. Is Ollama running?</div>
          ) : (
            Object.entries(fleet.groups).map(([group, models]) => (
              <div key={group} style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa', marginBottom: 10, borderBottom: '1px solid #1e1e2e', paddingBottom: 6 }}>
                  {group} <span style={{ color: '#555', fontWeight: 400, fontSize: 13 }}>({models.length})</span>
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {models.map(m => (
                    <div key={m.name} style={{
                      background: '#0d1117', border: '1px solid #1e1e2e', borderRadius: 8,
                      padding: '10px 14px', minWidth: 200,
                    }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#e0e0e0', fontSize: 13 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        {m.parameter_size !== 'unknown' ? m.parameter_size : ''}
                        {m.size_bytes > 0 ? ` · ${(m.size_bytes / 1e9).toFixed(1)} GB` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{m.family}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Policy ────────────────────────────────────────────────────────────── */}
      {activeTab === 'policy' && (
        <div style={{ maxWidth: 760 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', marginBottom: 20 }}>
            Ollama-First Policy
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {[
              { icon: '🏠', text: 'All AI tasks route through Ollama first — no cloud API calls unless Ollama is offline.' },
              { icon: '🎯', text: 'Model selection is automatic — the dispatcher picks the best available model per task type from a priority-ordered preference list.' },
              { icon: '🔁', text: 'Fallback chain: Ollama preferred model → Ollama any available model → Cloud (if configured via env vars).' },
              { icon: '🔒', text: 'Privacy: all prompts stay local by default. Cloud fallback requires explicit OPENAI_API_KEY / ANTHROPIC_API_KEY env vars.' },
              { icon: '🛠', text: 'Migration target: replace all 413 routes using hardcoded model: \'llama3.2\' with dispatchToOllama(taskType, prompt) calls.' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#0d1117', border: '1px solid #1e1e2e', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <p style={{ margin: 0, color: '#ccc', fontSize: 14, lineHeight: 1.6 }}>{item.text}</p>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', marginBottom: 12 }}>
            Cost Comparison: 1,000 Tasks / Day
          </h3>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, marginBottom: 28 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                {['Provider', 'Model', 'Est. Cost/1K tasks', 'Monthly (30d)', 'Privacy'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COST_ROWS.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1e1e2e', background: row.highlight ? '#0d2d1a' : 'transparent' }}>
                  <td style={{ padding: '8px 12px', color: row.highlight ? '#22c55e' : '#e0e0e0', fontWeight: row.highlight ? 700 : 400 }}>{row.provider}</td>
                  <td style={{ padding: '8px 12px', color: '#888', fontFamily: 'monospace', fontSize: 12 }}>{row.model}</td>
                  <td style={{ padding: '8px 12px', color: row.highlight ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>{row.cost}</td>
                  <td style={{ padding: '8px 12px', color: row.highlight ? '#22c55e' : '#f87171', fontWeight: 600 }}>{row.monthly}</td>
                  <td style={{ padding: '8px 12px', color: '#888' }}>{row.privacy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const MIGRATION_ROWS: { module: string; current: string; taskType: string; target: string; status: 'migrated' | 'pending' }[] = [
  { module: 'api/admin/ollama-strategy', current: 'dispatcher', taskType: 'all', target: 'dispatchToOllama()', status: 'migrated' },
  { module: 'api/mcp/social', current: "llama3.2", taskType: 'marketing_copy', target: 'qwen2.5:latest', status: 'pending' },
  { module: 'api/admin/blog/generate', current: "llama3.2", taskType: 'text_generation', target: 'qwen3:8b', status: 'pending' },
  { module: 'api/admin/seo/analyze', current: "llama3.2", taskType: 'seo_analysis', target: 'qwen3:8b', status: 'pending' },
  { module: 'api/admin/social/compose', current: "llama3.2", taskType: 'marketing_copy', target: 'qwen2.5:latest', status: 'pending' },
  { module: 'api/admin/leads/qualify', current: "llama3.2", taskType: 'classification', target: 'qwen3:8b', status: 'pending' },
  { module: 'api/admin/email/draft', current: "llama3.2", taskType: 'email_draft', target: 'qwen2.5:latest', status: 'pending' },
  { module: 'api/admin/market-research/summarize', current: "llama3.2", taskType: 'summarization', target: 'qwen2.5:latest', status: 'pending' },
  { module: 'api/admin/ads/copy-gen', current: "llama3.2", taskType: 'marketing_copy', target: 'qwen2.5:latest', status: 'pending' },
  { module: 'api/admin/video/caption', current: "llama3.2", taskType: 'summarization', target: 'qwen2.5:latest', status: 'pending' },
  { module: 'api/admin/content-safety/check', current: "llama3.2", taskType: 'content_safety', target: 'llama-guard3:latest', status: 'pending' },
  { module: 'api/admin/reviews/sentiment', current: "llama3.2", taskType: 'sentiment_analysis', target: 'qwen3:8b', status: 'pending' },
  { module: 'api/admin/rag/extract', current: "llama3.2", taskType: 'entity_extraction', target: 'qwen3:8b', status: 'pending' },
  { module: 'api/admin/agents/plan', current: "llama3.2", taskType: 'planning', target: 'qwen3:8b', status: 'pending' },
  { module: 'api/admin/code-gen/scaffold', current: "llama3.2", taskType: 'code_generation', target: 'qwen2.5-coder:latest', status: 'pending' },
  { module: 'api/admin/translation/auto', current: "llama3.2", taskType: 'translation', target: 'qwen2.5:latest', status: 'pending' },
  { module: 'api/admin/data-analysis/insights', current: "llama3.2", taskType: 'data_analysis', target: 'deepseek-r1:8b', status: 'pending' },
  { module: 'api/admin/qa/faq-gen', current: "llama3.2", taskType: 'qa', target: 'qwen3:8b', status: 'pending' },
  { module: 'api/admin/reasoning/explain', current: "llama3.2", taskType: 'reasoning', target: 'deepseek-r1:8b', status: 'pending' },
  { module: 'api/admin/embeddings/index', current: "llama3.2", taskType: 'embedding', target: 'nomic-embed-text:latest', status: 'pending' },
];

const COST_ROWS: { provider: string; model: string; cost: string; monthly: string; privacy: string; highlight?: boolean }[] = [
  { provider: 'Ollama (local)', model: 'qwen3:8b / deepseek-r1:8b', cost: '$0.00', monthly: '$0.00', privacy: 'fully local', highlight: true },
  { provider: 'OpenAI', model: 'gpt-4o-mini', cost: '~$1.50', monthly: '~$45', privacy: 'data sent to cloud' },
  { provider: 'OpenAI', model: 'gpt-4o', cost: '~$15.00', monthly: '~$450', privacy: 'data sent to cloud' },
  { provider: 'Anthropic', model: 'claude-haiku', cost: '~$1.25', monthly: '~$37', privacy: 'data sent to cloud' },
  { provider: 'Anthropic', model: 'claude-sonnet', cost: '~$18.00', monthly: '~$540', privacy: 'data sent to cloud' },
  { provider: 'HuggingFace', model: 'inference API', cost: '~$0.50', monthly: '~$15', privacy: 'data sent to cloud' },
];
