'use client';

import { useState, useEffect } from 'react';

interface Client {
  id: number;
  name: string;
  email: string;
  due_date: string;
  pregnancy_week: number;
  midwife: string;
  status: string;
  created_at: string;
}

interface Appointment {
  id: number;
  client_name: string;
  midwife: string;
  appointment_type: string;
  scheduled_at: string;
  notes: string;
  status: string;
}

export default function MidwiferyPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<'clients' | 'appointments' | 'ai'>('clients');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/midwifery')
      .then(r => r.json())
      .then(d => { setClients(d.clients || []); setAppointments(d.appointments || []); })
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

  const statusColor = (s: string) => ({ active: 'bg-pink-100 text-pink-700', postpartum: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', scheduled: 'bg-blue-100 text-blue-700' }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Midwifery Practice</h1>
        <p className="text-gray-600 mt-1">Manage prenatal clients, appointments, and care plans</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Clients', value: clients.filter(c => c.status === 'active').length, color: 'bg-pink-500' },
          { label: 'Due This Month', value: clients.filter(c => { const d = new Date(c.due_date); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length, color: 'bg-purple-500' },
          { label: 'Upcoming Appts', value: appointments.filter(a => a.status === 'scheduled').length, color: 'bg-blue-500' },
          { label: 'Total Clients', value: clients.length, color: 'bg-green-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['clients', 'appointments', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-pink-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Care Notes' : t === 'appointments' ? 'Appointments' : 'Clients'}
          </button>
        ))}
      </div>

      {activeTab === 'clients' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Prenatal Clients</h2>
            <button className="bg-pink-600 text-white px-3 py-1.5 rounded text-sm hover:bg-pink-700">+ New Client</button>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : clients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No clients yet. Add your first prenatal client.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Name', 'Due Date', 'Week', 'Midwife', 'Status', 'Since'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.due_date}</td>
                    <td className="px-4 py-3 text-gray-600">Week {c.pregnancy_week}</td>
                    <td className="px-4 py-3 text-gray-600">{c.midwife}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(c.status)}`}>{c.status}</span></td>
                    <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Appointments</h2>
            <button className="bg-pink-600 text-white px-3 py-1.5 rounded text-sm hover:bg-pink-700">+ Schedule</button>
          </div>
          {appointments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No appointments scheduled.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Client', 'Midwife', 'Type', 'Scheduled', 'Notes', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.client_name}</td>
                    <td className="px-4 py-3 text-gray-600">{a.midwife}</td>
                    <td className="px-4 py-3 text-gray-600">{a.appointment_type}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(a.scheduled_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{a.notes}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(a.status)}`}>{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Care Notes Assistant</h2>
          <div className="mb-3 p-3 bg-pink-50 border border-pink-200 rounded-lg text-xs text-pink-700">
            Note: AI-generated content is for documentation assistance only. All clinical decisions must be made by a qualified midwife.
          </div>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe a clinical situation for note-taking assistance, patient education content, or care plan documentation..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-pink-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-pink-700 disabled:opacity-50">{aiLoading ? 'Generating...' : 'Generate Notes'}</button>
          {aiResponse && <div className="mt-4 p-4 bg-pink-50 border border-pink-200 rounded-lg"><p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p></div>}
        </div>
      )}
    </div>
  );
}
