'use client';

import { useState, useEffect, useCallback } from 'react';

interface MainRow {
  id: string;
    workflow_name: string | number | boolean | string[] | null;
  platform: string | number | boolean | string[] | null;
  trigger_type: string | number | boolean | string[] | null;
  steps_count: string | number | boolean | string[] | null;
  runs_today: string | number | boolean | string[] | null;
  success_rate: string | number | boolean | string[] | null;
  business_owner: string | number | boolean | string[] | null;
  status: string | number | boolean | string[] | null;
  created_at: string | number | boolean | string[] | null;
}

interface ChildRow {
  id: string;
  workflow_id: string;
    triggered_at: string | number | boolean | string[] | null;
  duration_ms: string | number | boolean | string[] | null;
  status: string | number | boolean | string[] | null;
  error_message: string | number | boolean | string[] | null;
  created_at: string;
}

export default function NocodeAutomationPage() {
  const [items, setItems] = useState<MainRow[]>([]);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'main' | 'secondary' | 'ai'>('main');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    "workflow_name": "", "platform": "", "trigger_type": "", "steps_count": "", "runs_today": "", "success_rate": "", "business_owner": "", "status": ""
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [aiPrompt, setAiPrompt] = useState('Analyze no-code workflow efficiency and recommend automation opportunities');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/nocode-automation');
      if (!res.ok) { setError('Failed to load data'); return; }
      const d = await res.json() as { items: MainRow[], children: ChildRow[] };
      setItems(d.items ?? []);
      setChildren(d.children ?? []);
    } catch { setError('Network error'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) })
      .then(r => setOllamaStatus(r.ok ? 'online' : 'offline'))
      .catch(() => setOllamaStatus('offline'));
  }, []);

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/nocode-automation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { notify('Saved'); setShowModal(false); void load(); }
      else notify('Save failed');
    } catch { notify('Error saving'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    await fetch(`/api/admin/nocode-automation?id=${id}`, { method: 'DELETE' });
    notify('Deleted'); void load();
  };

  const handleAiQuery = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiResponse('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt: aiPrompt + '\n\nContext: ' + JSON.stringify(items.slice(0, 5)), stream: false }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const d = await res.json() as { response?: string };
        setAiResponse(d.response ?? 'No response');
      } else setAiResponse('Ollama returned an error. Check if the model is available.');
    } catch (e) {
      setAiResponse(ollamaStatus === 'offline'
        ? 'Ollama is offline. Start it with: ollama serve'
        : `AI query failed: ${String(e)}`);
    } finally { setAiLoading(false); }
  };

  const TABS = ['main', 'secondary', 'ai'] as const;
  const TAB_LABELS = { main: 'No-Code / Low-Code Automation', secondary: 'Nocode Run', ai: 'AI Assistant' };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔧 No-Code / Low-Code Automation</h1>
          <p className="text-gray-500 text-sm mt-1">Manage no-code / low-code automation data and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${ollamaStatus === 'online' ? 'bg-green-100 text-green-700' : ollamaStatus === 'offline' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
            Ollama {ollamaStatus}
          </span>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add New
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 px-4 py-2 bg-blue-50 text-blue-700 rounded text-sm">{msg}</div>}

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'main' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No No-Code / Low-Code Automation items yet. Click &quot;+ Add New&quot; to get started.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workflow Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Steps Count</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Runs Today</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Success Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-900">{String(item.workflow_name ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(item.platform ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(item.trigger_type ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(item.steps_count ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(item.runs_today ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(item.success_rate ?? '—')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'secondary' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Nocode Run</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700">{items.length}</div>
              <div className="text-sm text-blue-600">Total No-Code / Low-Code Automation Items</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700">{items.filter(i => String(i.status) === 'active').length}</div>
              <div className="text-sm text-green-600">Active</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-700">{children.length}</div>
              <div className="text-sm text-purple-600">Related Records</div>
            </div>
          </div>
          {children.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No nocode run records yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Triggered At</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration Ms</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {children.slice(0, 50).map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-900">{String(c.triggered_at ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(c.duration_ms ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(c.status ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(c.error_message ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'ai' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">AI Assistant</h2>
          <div className="mb-4">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ask AI about your no-code / low-code automation data..."
            />
            <button onClick={handleAiQuery} disabled={aiLoading || ollamaStatus === 'offline'}
              className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {aiLoading ? 'Thinking...' : 'Ask AI'}
            </button>
          </div>
          {aiResponse && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{aiResponse}</div>
          )}
          {ollamaStatus === 'offline' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
              Ollama is offline. Start it with: <code className="bg-yellow-100 px-1 rounded">ollama serve</code>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add No-Code / Low-Code Automation</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
                            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Workflow Name</label>
                <input type="text" value={form.workflow_name} onChange={e => setForm(f => ({...f, workflow_name: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                <input type="text" value={form.platform} onChange={e => setForm(f => ({...f, platform: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Trigger Type</label>
                <input type="text" value={form.trigger_type} onChange={e => setForm(f => ({...f, trigger_type: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Steps Count</label>
                <input type="text" value={form.steps_count} onChange={e => setForm(f => ({...f, steps_count: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Runs Today</label>
                <input type="text" value={form.runs_today} onChange={e => setForm(f => ({...f, runs_today: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Success Rate</label>
                <input type="text" value={form.success_rate} onChange={e => setForm(f => ({...f, success_rate: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Business Owner</label>
                <input type="text" value={form.business_owner} onChange={e => setForm(f => ({...f, business_owner: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <input type="text" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
