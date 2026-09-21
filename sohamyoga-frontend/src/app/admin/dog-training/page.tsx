'use client';

import { useState, useEffect } from 'react';

interface Dog {
  id: number;
  dog_name: string;
  breed: string;
  owner_name: string;
  owner_email: string;
  training_goal: string;
  status: string;
  created_at: string;
}

interface TrainingSession {
  id: number;
  dog_name: string;
  trainer: string;
  session_type: string;
  scheduled_at: string;
  status: string;
}

export default function DogTrainingPage() {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [activeTab, setActiveTab] = useState<'dogs' | 'sessions' | 'ai'>('dogs');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dog-training')
      .then(r => r.json())
      .then(d => { setDogs(d.dogs || []); setSessions(d.sessions || []); })
      .finally(() => setLoading(false));
  }, []);

  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const d = await res.json();
      setAiResponse(d.text || d.error || 'No response');
    } catch {
      setAiResponse('AI unavailable');
    } finally {
      setAiLoading(false);
    }
  };

  const statusColor = (s: string) => s === 'active' ? 'bg-green-100 text-green-700' : s === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600';

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dog Training</h1>
        <p className="text-gray-600 mt-1">Manage dog training clients, sessions, and programs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Dogs Enrolled', value: dogs.length, color: 'bg-yellow-500' },
          { label: 'Active Training', value: dogs.filter(d => d.status === 'active').length, color: 'bg-green-500' },
          { label: 'Sessions Today', value: sessions.filter(s => new Date(s.scheduled_at).toDateString() === new Date().toDateString()).length, color: 'bg-blue-500' },
          { label: 'Total Sessions', value: sessions.length, color: 'bg-purple-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['dogs', 'sessions', 'ai'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-yellow-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            {t === 'ai' ? 'AI Training Tips' : t === 'sessions' ? 'Sessions' : 'Dogs & Owners'}
          </button>
        ))}
      </div>

      {activeTab === 'dogs' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Enrolled Dogs</h2>
            <button className="bg-yellow-600 text-white px-3 py-1.5 rounded text-sm hover:bg-yellow-700">+ Enroll Dog</button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : dogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No dogs enrolled yet. Add your first training client.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Dog', 'Breed', 'Owner', 'Goal', 'Status', 'Enrolled'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {dogs.map(d => (
                  <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{d.dog_name}</td>
                    <td className="px-4 py-3 text-gray-600">{d.breed}</td>
                    <td className="px-4 py-3 text-gray-600">{d.owner_name}</td>
                    <td className="px-4 py-3 text-gray-600">{d.training_goal}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(d.status)}`}>{d.status}</span></td>
                    <td className="px-4 py-3 text-gray-500">{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Training Sessions</h2>
            <button className="bg-yellow-600 text-white px-3 py-1.5 rounded text-sm hover:bg-yellow-700">+ Schedule Session</button>
          </div>
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No sessions scheduled yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Dog', 'Trainer', 'Type', 'Scheduled', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.dog_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.trainer}</td>
                    <td className="px-4 py-3 text-gray-600">{s.session_type}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(s.scheduled_at).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status)}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Training Assistant</h2>
          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="Ask about training techniques, behavioral issues, breed-specific tips..."
            className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-700 disabled:opacity-50">
            {aiLoading ? 'Generating...' : 'Get Training Tips'}
          </button>
          {aiResponse && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
