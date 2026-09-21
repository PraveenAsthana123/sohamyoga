'use client';

import { useState, useEffect } from 'react';

interface Job {
  id: number;
  job_number: string;
  client_name: string;
  address: string;
  job_type: string;
  electrician: string;
  scheduled_date: string;
  status: string;
  amount: number;
}

export default function ElectricalContractorPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<'jobs' | 'calendar' | 'ai'>('jobs');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/admin/electrical-contractor')
      .then(r => r.json())
      .then(d => setJobs(d.jobs || []))
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

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);
  const statusColor = (s: string) => ({ scheduled: 'bg-blue-100 text-blue-700', 'in-progress': 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Electrical Contractor</h1>
        <p className="text-gray-600 mt-1">Manage electrical jobs, scheduling, and client accounts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Jobs', value: jobs.length, color: 'bg-yellow-500' },
          { label: 'In Progress', value: jobs.filter(j => j.status === 'in-progress').length, color: 'bg-blue-500' },
          { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: 'bg-green-500' },
          { label: 'Revenue', value: `$${jobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.amount || 0), 0).toLocaleString()}`, color: 'bg-purple-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['jobs', 'calendar', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-yellow-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Estimator' : t === 'calendar' ? 'Schedule' : 'Jobs'}
          </button>
        ))}
      </div>

      {activeTab === 'jobs' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex gap-2">
              {['all', 'scheduled', 'in-progress', 'completed'].map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded text-xs font-medium capitalize ${filter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f}</button>
              ))}
            </div>
            <button className="bg-yellow-600 text-white px-3 py-1.5 rounded text-sm hover:bg-yellow-700">+ New Job</button>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No jobs found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Job #', 'Client', 'Address', 'Type', 'Electrician', 'Date', 'Amount', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(j => (
                  <tr key={j.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{j.job_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{j.client_name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{j.address}</td>
                    <td className="px-4 py-3 text-gray-600">{j.job_type}</td>
                    <td className="px-4 py-3 text-gray-600">{j.electrician}</td>
                    <td className="px-4 py-3 text-gray-500">{j.scheduled_date}</td>
                    <td className="px-4 py-3 text-gray-700">${(j.amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(j.status)}`}>{j.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Job Schedule</h2>
          {jobs.filter(j => j.status === 'scheduled' || j.status === 'in-progress').length === 0 ? (
            <p className="text-gray-500 text-sm">No upcoming scheduled jobs.</p>
          ) : (
            <div className="space-y-3">
              {jobs.filter(j => j.status === 'scheduled' || j.status === 'in-progress').map(j => (
                <div key={j.id} className="flex items-center gap-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{j.client_name} — {j.job_type}</p>
                    <p className="text-xs text-gray-500">{j.address} · {j.electrician}</p>
                  </div>
                  <span className="text-xs text-gray-500">{j.scheduled_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Job Estimator</h2>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe the electrical job for cost estimation, code requirements, or material lists..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-700 disabled:opacity-50">{aiLoading ? 'Generating...' : 'Generate Estimate'}</button>
          {aiResponse && <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"><p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p></div>}
        </div>
      )}
    </div>
  );
}
