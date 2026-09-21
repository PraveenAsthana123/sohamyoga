'use client';

import { useState, useEffect } from 'react';

interface Study {
  id: number;
  study_name: string;
  client_name: string;
  methodology: string;
  sample_size: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface Finding {
  id: number;
  study_name: string;
  insight: string;
  confidence: string;
  created_at: string;
}

export default function MarketResearchFirmPage() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [activeTab, setActiveTab] = useState<'studies' | 'findings' | 'ai'>('studies');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/market-research-firm')
      .then(r => r.json())
      .then(d => { setStudies(d.studies || []); setFindings(d.findings || []); })
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

  const statusColor = (s: string) => ({ 'in-progress': 'bg-blue-100 text-blue-700', planning: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', 'data-collection': 'bg-yellow-100 text-yellow-700' }[s] || 'bg-gray-100 text-gray-600');
  const confidenceColor = (c: string) => ({ high: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-red-100 text-red-700' }[c] || 'bg-gray-100 text-gray-600');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Market Research Firm</h1>
        <p className="text-gray-600 mt-1">Manage research studies, methodologies, and client insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Studies', value: studies.filter(s => s.status === 'in-progress').length, color: 'bg-blue-500' },
          { label: 'Total Studies', value: studies.length, color: 'bg-purple-500' },
          { label: 'Key Findings', value: findings.length, color: 'bg-green-500' },
          { label: 'Total Respondents', value: studies.reduce((sum, s) => sum + (s.sample_size || 0), 0).toLocaleString(), color: 'bg-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['studies', 'findings', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Analysis' : t === 'findings' ? 'Key Findings' : 'Studies'}
          </button>
        ))}
      </div>

      {activeTab === 'studies' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Research Studies</h2>
            <button className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">+ New Study</button>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : studies.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No studies yet. Create your first research study.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Study Name', 'Client', 'Methodology', 'Sample', 'Start', 'End', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {studies.map(s => (
                  <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.study_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.client_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.methodology}</td>
                    <td className="px-4 py-3 text-gray-600">n={s.sample_size}</td>
                    <td className="px-4 py-3 text-gray-500">{s.start_date}</td>
                    <td className="px-4 py-3 text-gray-500">{s.end_date}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status)}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'findings' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">Key Research Findings</h2>
            <button className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">+ Add Finding</button>
          </div>
          {findings.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No findings recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {findings.map(f => (
                <div key={f.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-gray-600">{f.study_name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColor(f.confidence)}`}>{f.confidence} confidence</span>
                  </div>
                  <p className="text-sm text-gray-800 mt-2">{f.insight}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(f.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Research Analyst</h2>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Paste survey data, ask for insight synthesis, hypothesis generation, or methodology recommendations..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{aiLoading ? 'Analyzing...' : 'Analyze Research'}</button>
          {aiResponse && <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"><p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p></div>}
        </div>
      )}
    </div>
  );
}
