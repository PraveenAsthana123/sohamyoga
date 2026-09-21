'use client';

import { useState, useEffect } from 'react';

interface Booking {
  id: number;
  booking_number: string;
  artist_name: string;
  studio_room: string;
  engineer: string;
  session_type: string;
  start_time: string;
  end_time: string;
  rate_per_hour: number;
  status: string;
}

interface Track {
  id: number;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  recorded_at: string;
  status: string;
}

export default function RecordingStudioPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTab, setActiveTab] = useState<'bookings' | 'catalog' | 'ai'>('bookings');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/recording-studio')
      .then(r => r.json())
      .then(d => { setBookings(d.bookings || []); setTracks(d.tracks || []); })
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

  const statusColor = (s: string) => ({ confirmed: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', 'in-progress': 'bg-blue-100 text-blue-700', completed: 'bg-purple-100 text-purple-700', cancelled: 'bg-red-100 text-red-700', mixing: 'bg-orange-100 text-orange-700', mastered: 'bg-green-100 text-green-700' }[s] || 'bg-gray-100 text-gray-600');

  const totalRevenue = bookings.filter(b => b.status === 'completed').reduce((sum, b) => {
    if (b.start_time && b.end_time) {
      const hours = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
      return sum + hours * (b.rate_per_hour || 0);
    }
    return sum;
  }, 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recording Studio</h1>
        <p className="text-gray-600 mt-1">Manage studio bookings, track catalog, and session engineers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Bookings', value: bookings.filter(b => b.status === 'confirmed' || b.status === 'in-progress').length, color: 'bg-purple-500' },
          { label: 'Total Tracks', value: tracks.length, color: 'bg-blue-500' },
          { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, color: 'bg-green-500' },
          { label: 'Pending', value: bookings.filter(b => b.status === 'pending').length, color: 'bg-yellow-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['bookings', 'catalog', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-purple-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Lyrics & Copy' : t === 'catalog' ? 'Track Catalog' : 'Studio Bookings'}
          </button>
        ))}
      </div>

      {activeTab === 'bookings' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Studio Bookings</h2>
            <button className="bg-purple-700 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-800">+ New Booking</button>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : bookings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No bookings yet. Schedule your first studio session.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['#', 'Artist', 'Room', 'Engineer', 'Type', 'Start', 'Rate/Hr', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.booking_number}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{b.artist_name}</td>
                    <td className="px-4 py-3 text-gray-600">{b.studio_room}</td>
                    <td className="px-4 py-3 text-gray-600">{b.engineer}</td>
                    <td className="px-4 py-3 text-gray-600">{b.session_type}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(b.start_time).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700">${b.rate_per_hour}/hr</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(b.status)}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Track Catalog</h2>
            <button className="bg-purple-700 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-800">+ Add Track</button>
          </div>
          {tracks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No tracks recorded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Title', 'Artist', 'Genre', 'Duration', 'Recorded', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {tracks.map(t => (
                  <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{t.title}</td>
                    <td className="px-4 py-3 text-gray-600">{t.artist}</td>
                    <td className="px-4 py-3 text-gray-600">{t.genre}</td>
                    <td className="px-4 py-3 text-gray-600">{t.duration}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(t.recorded_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(t.status)}`}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Creative Assistant</h2>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Ask for lyrics ideas, artist bio writing, press release, social media copy for music releases..." className="w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-purple-600" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-purple-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-800 disabled:opacity-50">{aiLoading ? 'Creating...' : 'Generate Content'}</button>
          {aiResponse && <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg"><p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p></div>}
        </div>
      )}
    </div>
  );
}
