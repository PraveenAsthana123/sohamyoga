'use client';

import { useState, useEffect } from 'react';

interface Job {
  id: number;
  job_number: string;
  customer_name: string;
  address: string;
  pest_type: string;
  service_type: string;
  technician: string;
  scheduled_date: string;
  status: string;
  amount: number;
}

export default function PestControlPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<'jobs' | 'routes' | 'ai'>('jobs');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/admin/pest-control')
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
        <h1 className="text-2xl font-bold text-gray-900">Pest Control</h1>
        <p className="text-gray-600 mt-1">Manage service jobs, routes, and pest treatment records</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Today's Jobs", value: jobs.filter(j => j.scheduled_date === new Date().toISOString().split('T')[0]).length, color: 'bg-green-500' },
          { label: 'Scheduled', value: jobs.filter(j => j.status === 'scheduled').length, color: 'bg-blue-500' },
          { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: 'bg-purple-500' },
          { label: 'Revenue', value: `$${jobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.amount || 0), 0).toLocaleString()}`, color: 'bg-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['jobs', 'routes', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-green-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Treatment Advisor' : t === 'routes' ? 'Technician Routes' : 'Service Jobs'}
          </button>
        ))}
      </div>

      {activeTab === 'jobs' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex gap-2">
              {['all', 'scheduled', 'in-progress', 'completed'].map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded text-xs font-medium capitalize ${filter === f ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f}</button>
              ))}
            </div>
            <button className="bg-green-700 text-white px-3 py-1.5 rounded text-sm hover:bg-green-800">+ New Job</button>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No jobs found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Job #', 'Customer', 'Address', 'Pest', 'Service', 'Technician', 'Date', 'Amount', 'Status'].map(h => <th key={h} className="px-3 py-3 text-left text-gray-600 font-medium text-xs">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(j => (
                  <tr key={j.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 font-mono text-xs text-gray-500">{j.job_number}</td>
                    <td className="px-3 py-3 font-medium text-gray-900 text-xs">{j.customer_name}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{j.address}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{j.pest_type}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{j.service_type}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{j.technician}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{j.scheduled_date}</td>
                    <td className="px-3 py-3 text-gray-700 text-xs">${(j.amount || 0).toLocaleString()}</td>
                    <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(j.status)}`}>{j.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'routes' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Technician Routes Today</h2>
          {jobs.filter(j => j.status === 'scheduled').length === 0 ? (
            <p className="text-gray-500 text-sm">No scheduled jobs for routing.</p>
          ) : (
            <div className="space-y-2">
              {Array.from(new Set(jobs.filter(j => j.status === 'scheduled').map(j => j.technician))).map(tech => (
                <div key={tech} className="border border-gray-200 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-2">{tech}</p>
                  <div className="space-y-1">
                    {jobs.filter(j => j.technician === tech && j.status === 'scheduled').map(j => (
                      <div key={j.id} className="flex gap-3 text-sm text-gray-600">
                        <span className="text-xs text-gray-400">{j.scheduled_date}</span>
                        <span>{j.customer_name}</span>
                        <span className="text-gray-400">—</span>
                        <span>{j.pest_type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Treatment Advisor</h2>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe pest issue, property type, infestation severity for treatment recommendations..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-green-600" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-green-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-800 disabled:opacity-50">{aiLoading ? 'Generating...' : 'Get Treatment Plan'}</button>
          {aiResponse && <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg"><p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p></div>}
        </div>
      )}
    </div>
  );
}
