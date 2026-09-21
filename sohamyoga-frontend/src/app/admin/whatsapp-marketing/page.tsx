'use client';

import { useEffect, useState } from 'react';

interface WaContact { id: number; name: string; phone: string; group_name: string | null; opt_in: boolean; created_at: string; }
interface WaMessage { id: number; message_type: string; content: string | null; recipient_count: number; sent_at: string | null; status: string; created_at: string; }
interface Summary { totalContacts: number; totalMessages: number; optInRate: number; }
interface ApiData { contacts: WaContact[]; messages: WaMessage[]; summary: Summary; }

const TABS = ['Overview', 'Contacts', 'Messages', 'AI Outreach Generator'] as const;
type Tab = typeof TABS[number];

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : '—'; }
function fmtNum(n: number | null | undefined) { return Number(n ?? 0).toLocaleString(); }
function badge(s: string) {
  if (s === 'sent') return 'bg-green-100 text-green-800';
  if (s === 'draft') return 'bg-yellow-100 text-yellow-800';
  if (s === 'failed') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-600';
}
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-16 text-center text-gray-400"><p className="text-4xl mb-2">📭</p><p className="text-sm">{msg}</p></div>;
}

export default function WhatsappMarketingPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/whatsapp-marketing')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ApiData>; })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function generateAi() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiResult('');
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3', prompt: `Write a short, friendly WhatsApp broadcast message for: ${aiPrompt}. Keep it under 200 characters. Include a clear call-to-action.`, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) { const j = await res.json() as { response?: string }; setAiResult(j.response ?? ''); }
      else setAiResult('Ollama returned an error.');
    } catch { setAiResult('Ollama unavailable. Run: ollama serve'); }
    finally { setAiLoading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" /></div>;
  if (error || !data) return <div className="p-6 text-red-600 bg-red-50 rounded-lg">Error: {error ?? 'Unknown'}</div>;

  const { contacts, messages, summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">WA</div>
        <div><h1 className="text-2xl font-bold text-gray-900">WhatsApp Marketing</h1><p className="text-sm text-gray-500">Group messaging, B2B groups, broadcast lists</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Contacts" value={fmtNum(summary.totalContacts)} color="text-gray-900" />
        <KpiCard label="Messages Sent" value={fmtNum(summary.totalMessages)} color="text-green-700" />
        <KpiCard label="Opt-In Rate" value={`${summary.optInRate}%`} color="text-blue-700" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab}</button>)}
        </nav>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {activeTab === 'Overview' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Channel Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Total Contacts</p><p className="text-xl font-bold">{fmtNum(summary.totalContacts)}</p></div>
              <div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Opted In</p><p className="text-xl font-bold text-green-700">{fmtNum(Math.round(summary.totalContacts * summary.optInRate / 100))}</p></div>
              <div className="bg-blue-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Broadcasts</p><p className="text-xl font-bold text-blue-700">{fmtNum(messages.filter(m => m.message_type === 'broadcast').length)}</p></div>
            </div>
          </div>
        )}

        {activeTab === 'Contacts' && (
          <div className="overflow-x-auto">
            {contacts.length === 0 ? <Empty msg="No contacts yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Name', 'Phone', 'Group', 'Opt-In', 'Added'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {contacts.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                      <td className="px-4 py-3 text-gray-500">{c.group_name ?? '—'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.opt_in ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{c.opt_in ? 'Yes' : 'No'}</span></td>
                      <td className="px-4 py-3 text-gray-500">{fmt(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Messages' && (
          <div className="overflow-x-auto">
            {messages.length === 0 ? <Empty msg="No messages yet." /> : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50"><tr>{['Content', 'Type', 'Recipients', 'Status', 'Sent'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {messages.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 max-w-xs truncate text-gray-900">{m.content ?? '—'}</td>
                      <td className="px-4 py-3 capitalize text-gray-600">{m.message_type}</td>
                      <td className="px-4 py-3">{fmtNum(m.recipient_count)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(m.status)}`}>{m.status}</span></td>
                      <td className="px-4 py-3 text-gray-500">{fmt(m.sent_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'AI Outreach Generator' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">AI WhatsApp Message Generator</h2>
            <p className="text-sm text-gray-500">Generate concise broadcast messages using local Ollama.</p>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Describe your message goal (e.g. 'weekend lunch special for the yoga community group')" />
            <button onClick={generateAi} disabled={aiLoading || !aiPrompt.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {aiLoading ? 'Generating...' : 'Generate Message'}
            </button>
            {aiResult && <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Output</p><pre className="text-sm text-gray-800 whitespace-pre-wrap">{aiResult}</pre></div>}
          </div>
        )}
      </div>
    </div>
  );
}
