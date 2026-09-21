'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: number;
  project_name: string;
  client_name: string;
  room_type: string;
  designer: string;
  budget: number;
  start_date: string;
  status: string;
}

interface Mood {
  id: number;
  project_name: string;
  style: string;
  colors: string;
  notes: string;
  created_at: string;
}

export default function InteriorDesignPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [activeTab, setActiveTab] = useState<'projects' | 'moodboards' | 'ai'>('projects');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/interior-design')
      .then(r => r.json())
      .then(d => { setProjects(d.projects || []); setMoods(d.moods || []); })
      .finally(() => setLoading(false));
  }, []);

  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt }) });
      const d = await res.json();
      setAiResponse(d.text || d.error || 'No response');
    } catch { setAiResponse('AI unavailable'); } finally { setAiLoading(false); }
  };

  const statusColor = (s: string) => ({ active: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', 'on-hold': 'bg-yellow-100 text-yellow-700', planning: 'bg-purple-100 text-purple-700' }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Interior Design</h1>
        <p className="text-gray-600 mt-1">Manage design projects, mood boards, and client consultations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Projects', value: projects.filter(p => p.status === 'active').length, color: 'bg-purple-500' },
          { label: 'Total Budget', value: `$${projects.reduce((s, p) => s + (p.budget || 0), 0).toLocaleString()}`, color: 'bg-green-500' },
          { label: 'Mood Boards', value: moods.length, color: 'bg-pink-500' },
          { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: 'bg-blue-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['projects', 'moodboards', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Design Ideas' : t === 'moodboards' ? 'Mood Boards' : 'Projects'}
          </button>
        ))}
      </div>

      {activeTab === 'projects' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Design Projects</h2>
            <button className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700">+ New Project</button>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : projects.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No projects yet. Start your first design project.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Project', 'Client', 'Room Type', 'Designer', 'Budget', 'Start Date', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.project_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.client_name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.room_type}</td>
                    <td className="px-4 py-3 text-gray-600">{p.designer}</td>
                    <td className="px-4 py-3 text-gray-700">${(p.budget || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{p.start_date}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(p.status)}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'moodboards' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">Mood Boards</h2>
            <button className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700">+ New Board</button>
          </div>
          {moods.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No mood boards created yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {moods.map(m => (
                <div key={m.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <p className="font-medium text-gray-900">{m.project_name}</p>
                  <p className="text-sm text-purple-600 mt-1">{m.style}</p>
                  <p className="text-xs text-gray-500 mt-1">Colors: {m.colors}</p>
                  {m.notes && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{m.notes}</p>}
                  <p className="text-xs text-gray-400 mt-2">{new Date(m.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Design Consultant</h2>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe a room, style preference, or ask for color palette suggestions..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">{aiLoading ? 'Generating...' : 'Get Design Ideas'}</button>
          {aiResponse && <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg"><p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p></div>}
        </div>
      )}
    </div>
  );
}
