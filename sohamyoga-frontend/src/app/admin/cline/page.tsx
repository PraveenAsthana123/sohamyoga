'use client';

import { useState, useEffect } from 'react';

interface ClineTask {
  id: number;
  task_number: string;
  title: string;
  description: string;
  task_type: string;
  target_file: string | null;
  target_repo: string | null;
  model_used: string;
  priority: string;
  status: string;
  tokens_used: number | null;
  cost_usd: number | null;
  output_summary: string | null;
  diff_preview: string | null;
  created_at: string;
  completed_at: string | null;
}

const TASK_TYPES = ['Code Generation', 'Bug Fix', 'Refactor', 'Test Writing', 'Documentation', 'Code Review', 'API Integration', 'Database Migration', 'Security Audit', 'Performance Optimization'];
const MODELS = ['claude-opus-4-5', 'claude-sonnet-4-5', 'gpt-4o', 'deepseek-coder-v2', 'qwen2.5-coder:32b (local)', 'codellama:70b (local)'];
const PRIORITIES = ['P0 - Critical', 'P1 - High', 'P2 - Medium', 'P3 - Low'];

export default function ClinePage() {
  const [tasks, setTasks] = useState<ClineTask[]>([]);
  const [activeTab, setActiveTab] = useState<'new-task' | 'history' | 'prompts' | 'settings'>('new-task');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('Code Generation');
  const [targetFile, setTargetFile] = useState('');
  const [targetRepo, setTargetRepo] = useState('sohamyoga-frontend');
  const [model, setModel] = useState('claude-opus-4-5');
  const [priority, setPriority] = useState('P2 - Medium');
  const [result, setResult] = useState('');
  const [selectedTask, setSelectedTask] = useState<ClineTask | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/cline')
      .then(r => r.json())
      .then(d => setTasks(d.items || []))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/cline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, task_type: taskType, target_file: targetFile || null, target_repo: targetRepo || null, model_used: model, priority }),
      });
      const d = await res.json();
      setResult(d.message || 'Task created');
      setTasks(prev => [d.task, ...prev].filter(Boolean));
      setTitle('');
      setDescription('');
      setTargetFile('');
    } catch { setResult('Failed to create task'); } finally { setSubmitting(false); }
  };

  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt }) });
      const d = await res.json();
      setAiResponse(d.text || d.error || 'No response');
    } catch { setAiResponse('AI unavailable'); } finally { setAiLoading(false); }
  };

  const statusColor = (s: string) => ({ pending: 'bg-yellow-100 text-yellow-700', running: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700', cancelled: 'bg-gray-100 text-gray-600' }[s] || 'bg-gray-100 text-gray-600');
  const priorityColor = (p: string) => p.startsWith('P0') ? 'text-red-600 font-bold' : p.startsWith('P1') ? 'text-orange-600 font-semibold' : p.startsWith('P2') ? 'text-blue-600' : 'text-gray-500';

  const PROMPT_TEMPLATES = [
    { label: 'New API Route', prompt: 'Create a new Next.js App Router API route at src/app/api/admin/[module]/route.ts. Include: requireAdmin auth, databaseConfigured check, getPool with pool.connect()/try/finally client.release(), CREATE TABLE IF NOT EXISTS, GET returning { items }, POST creating a record. Module: ' },
    { label: 'Fix TypeScript Error', prompt: 'Fix the TypeScript error in this file. Show the minimal change needed without altering functionality: ' },
    { label: 'Write Playwright Tests', prompt: 'Write comprehensive Playwright tests for this admin page covering: happy path, empty state, form validation, error states. Target file: ' },
    { label: 'Code Review', prompt: 'Review this code for: security vulnerabilities, TypeScript correctness, SQL injection risks, missing error handling, performance issues. File: ' },
    { label: 'Refactor to Pattern', prompt: 'Refactor this component to follow the standard sohamyoga admin page pattern: use client, useState hooks, useEffect data fetch, stats cards grid, tab navigation, table/AI tabs. File: ' },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cline Integration</h1>
        <p className="text-gray-600 mt-1">AI coding assistant task tracker — manage code generation, review, and refactor jobs across the codebase</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Tasks', value: tasks.length, color: 'bg-cyan-600' },
          { label: 'Completed', value: tasks.filter(t => t.status === 'completed').length, color: 'bg-green-500' },
          { label: 'Running', value: tasks.filter(t => t.status === 'running').length, color: 'bg-blue-500' },
          { label: 'Total Cost', value: `$${tasks.reduce((s, t) => s + (t.cost_usd || 0), 0).toFixed(4)}`, color: 'bg-purple-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['new-task', 'history', 'prompts', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === t ? 'bg-cyan-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'new-task' ? 'New Task' : t === 'history' ? 'Task History' : t === 'prompts' ? 'Prompt Templates' : 'Settings'}
          </button>
        ))}
      </div>

      {activeTab === 'new-task' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Add pagination to leads table" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
              <select value={taskType} onChange={e => setTaskType(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600">
                {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Prompt</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe exactly what needs to be done. Include file paths, requirements, constraints, and acceptance criteria..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target File</label>
              <input value={targetFile} onChange={e => setTargetFile(e.target.value)} placeholder="src/app/admin/..." className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repo</label>
              <input value={targetRepo} onChange={e => setTargetRepo(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <select value={model} onChange={e => setModel(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600">
                {MODELS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600">
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={submitting || !title.trim() || !description.trim()} className="bg-cyan-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-cyan-800 disabled:opacity-50">
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
            {result && <p className="text-sm text-green-600">{result}</p>}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">Task History</h2></div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No tasks yet.</div>
          ) : (
            <div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['#', 'Title', 'Type', 'Model', 'Priority', 'Tokens', 'Cost', 'Status', 'Created'].map(h => <th key={h} className="px-3 py-3 text-left text-gray-600 font-medium text-xs">{h}</th>)}</tr></thead>
                <tbody>
                  {tasks.map(t => (
                    <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedTask(selectedTask?.id === t.id ? null : t)}>
                      <td className="px-3 py-3 font-mono text-xs text-gray-400">{t.task_number}</td>
                      <td className="px-3 py-3 font-medium text-gray-900 text-xs">{t.title}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{t.task_type}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{t.model_used}</td>
                      <td className={`px-3 py-3 text-xs ${priorityColor(t.priority)}`}>{t.priority.split(' - ')[0]}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{t.tokens_used?.toLocaleString() || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{t.cost_usd != null ? `$${t.cost_usd.toFixed(4)}` : '—'}</td>
                      <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(t.status)}`}>{t.status}</span></td>
                      <td className="px-3 py-3 text-gray-400 text-xs">{new Date(t.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedTask?.output_summary && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <p className="text-xs font-medium text-gray-700 mb-1">Output Summary — {selectedTask.title}</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{selectedTask.output_summary}</p>
                  {selectedTask.diff_preview && <pre className="mt-2 text-xs bg-white border border-gray-200 rounded p-2 overflow-auto max-h-40">{selectedTask.diff_preview}</pre>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Prompt Templates</h2>
          <div className="space-y-3 mb-6">
            {PROMPT_TEMPLATES.map(pt => (
              <div key={pt.label} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{pt.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5 max-w-xl truncate">{pt.prompt}</p>
                </div>
                <button onClick={() => { setDescription(pt.prompt); setActiveTab('new-task'); }} className="text-xs text-cyan-700 hover:underline ml-4 whitespace-nowrap">Use →</button>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-medium text-gray-900 mb-2 text-sm">AI Prompt Assistant</h3>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe a coding task and I'll help draft a detailed Cline prompt for it..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-600" />
            <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-cyan-800 disabled:opacity-50">{aiLoading ? 'Writing...' : 'Draft Prompt'}</button>
            {aiResponse && (
              <div className="mt-3 p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p>
                <button onClick={() => { setDescription(aiResponse); setActiveTab('new-task'); }} className="mt-2 text-xs text-cyan-700 underline">Use as task description →</button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Cline Integration Settings</h2>
          <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-cyan-800">
            Cline is an open-source AI coding assistant for VS Code. This panel tracks Cline tasks and stores their outcomes in the database for cross-session visibility. Install Cline from the VS Code marketplace to execute tasks locally.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="font-medium text-gray-900 mb-1">VS Code Extension</p>
              <p className="text-gray-500 text-xs">Install: <span className="font-mono">ext install saoudrizwan.claude-dev</span></p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="font-medium text-gray-900 mb-1">Local Models (via Ollama)</p>
              <p className="text-gray-500 text-xs">Use qwen2.5-coder:32b or codellama:70b for zero-cost local execution</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="font-medium text-gray-900 mb-1">API Cost Tracking</p>
              <p className="text-gray-500 text-xs">Task cost and token usage are logged per task for budget monitoring</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="font-medium text-gray-900 mb-1">Task Webhook</p>
              <p className="text-gray-500 text-xs">POST completed task results to <span className="font-mono">/api/admin/cline</span> with status + output_summary</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
