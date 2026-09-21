'use client';

import { useState, useEffect, useCallback } from 'react';

interface MainRow {
  id: string;
    name: string | number | boolean | string[] | null;
  handle: string | number | boolean | string[] | null;
  platform: string | number | boolean | string[] | null;
  content_type: string | number | boolean | string[] | null;
  subscriber_count: string | number | boolean | string[] | null;
  monthly_views: string | number | boolean | string[] | null;
  monetization_type: string | number | boolean | string[] | null;
  revenue_share_pct: string | number | boolean | string[] | null;
  status: string | number | boolean | string[] | null;
  created_at: string | number | boolean | string[] | null;
}

interface ChildRow {
  id: string;
  creator_id: string;
    title: string | number | boolean | string[] | null;
  content_type: string | number | boolean | string[] | null;
  views: string | number | boolean | string[] | null;
  revenue: string | number | boolean | string[] | null;
  published_at: string | number | boolean | string[] | null;
  status: string | number | boolean | string[] | null;
  created_at: string;
}

export default function CreatorEconomyPage() {
  const [items, setItems] = useState<MainRow[]>([]);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'main' | 'secondary' | 'ai'>('main');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    "name": "", "handle": "", "platform": "", "content_type": "", "subscriber_count": "", "monthly_views": "", "monetization_type": "", "revenue_share_pct": ""
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [aiPrompt, setAiPrompt] = useState('Analyze creator performance metrics and recommend monetization strategies');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/creator-economy');
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
      const res = await fetch('/api/admin/creator-economy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { notify('Saved'); setShowModal(false); void load(); }
      else notify('Save failed');
    } catch { notify('Error saving'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    await fetch(`/api/admin/creator-economy?id=${id}`, { method: 'DELETE' });
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
  const TAB_LABELS = { main: 'Creator Economy Hub', secondary: 'Creator Content', ai: 'AI Assistant' };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎨 Creator Economy Hub</h1>
          <p className="text-gray-500 text-sm mt-1">Manage creator economy hub data and analytics</p>
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
            <div className="p-8 text-center text-gray-400">No Creator Economy Hub items yet. Click &quot;+ Add New&quot; to get started.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Handle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscriber Count</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Views</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-900">{String(item.name ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(item.handle ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(item.platform ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(item.content_type ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(item.subscriber_count ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(item.monthly_views ?? '—')}</td>
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
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Creator Content</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700">{items.length}</div>
              <div className="text-sm text-blue-600">Total Creator Economy Hub Items</div>
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
            <div className="text-center text-gray-400 py-8">No creator content records yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Views</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {children.slice(0, 50).map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-900">{String(c.title ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(c.content_type ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(c.views ?? '—')}</td>
                    <td className="px-4 py-3 text-gray-900">{String(c.revenue ?? '—')}</td>
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
              placeholder="Ask AI about your creator economy hub data..."
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
              <h3 className="text-lg font-semibold">Add Creator Economy Hub</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
                            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Handle</label>
                <input type="text" value={form.handle} onChange={e => setForm(f => ({...f, handle: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                <input type="text" value={form.platform} onChange={e => setForm(f => ({...f, platform: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Content Type</label>
                <input type="text" value={form.content_type} onChange={e => setForm(f => ({...f, content_type: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Subscriber Count</label>
                <input type="text" value={form.subscriber_count} onChange={e => setForm(f => ({...f, subscriber_count: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Views</label>
                <input type="text" value={form.monthly_views} onChange={e => setForm(f => ({...f, monthly_views: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monetization Type</label>
                <input type="text" value={form.monetization_type} onChange={e => setForm(f => ({...f, monetization_type: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Revenue Share Pct</label>
                <input type="number" value={form.revenue_share_pct} onChange={e => setForm(f => ({...f, revenue_share_pct: e.target.value}))}
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
