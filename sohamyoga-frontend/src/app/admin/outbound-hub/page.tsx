'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'sequences', 'contacts', 'copilot', 'chatbot'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard', sequences: 'Sequences', contacts: 'Contacts',
  copilot: 'AI Copilot', chatbot: 'Conversational AI',
};

interface Sequence { id: number; name: string; type: string; steps: Array<{ step: number; day: number; channel: string; subject: string; body: string }>; status: string; created_at: string; }
interface Contact { id: number; name: string; email: string; company?: string; sequence_id?: number; step_index: number; status: string; last_sent?: string; sequence_name?: string; }
interface ChatbotConfig { id: number; name: string; persona?: string; instructions?: string; channels?: string[]; status: string; }
interface ContactStats { total: string; active: string; completed: string; }
interface MessageStats { total: string; sent: string; }

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700', paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700', draft: 'bg-gray-100 text-gray-600',
};
const CHANNEL_COLORS: Record<string, string> = {
  email: 'bg-blue-100 text-blue-700', linkedin: 'bg-indigo-100 text-indigo-700',
  sms: 'bg-green-100 text-green-700', phone: 'bg-amber-100 text-amber-700',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50', green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50', purple: 'border-l-4 border-purple-500 bg-purple-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function OutboundHubPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [contactStats, setContactStats] = useState<ContactStats | null>(null);
  const [messageStats, setMessageStats] = useState<MessageStats | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [chatbots, setChatbots] = useState<ChatbotConfig[]>([]);
  const [loading, setLoading] = useState(false);
  // Copilot state
  const [copilot, setCopilot] = useState({ name: '', company: '', role: '', pain_point: '', industry: '', channel: 'email' });
  const [composedMsg, setComposedMsg] = useState<{ subject: string; body: string } | null>(null);
  const [composing, setComposing] = useState(false);
  // Chatbot test state
  const [selectedBot, setSelectedBot] = useState<number | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState<{ response: string; latency_ms: number } | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/outbound-hub').catch(() => null);
    if (res?.ok) { const d = await res.json(); setSequences(d.sequences || []); setContactStats(d.contactStats); setMessageStats(d.messageStats); }
    setLoading(false);
  }, []);

  const fetchContacts = useCallback(async () => {
    const res = await fetch('/api/admin/outbound-hub/contacts').catch(() => null);
    if (res?.ok) { const d = await res.json(); setContacts(d.contacts || []); }
  }, []);

  const fetchChatbots = useCallback(async () => {
    const res = await fetch('/api/admin/outbound-hub/chatbot').catch(() => null);
    if (res?.ok) { const d = await res.json(); setChatbots(d.configs || []); }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { if (tab === 'contacts') fetchContacts(); }, [tab, fetchContacts]);
  useEffect(() => { if (tab === 'chatbot') fetchChatbots(); }, [tab, fetchChatbots]);

  const advanceContact = async (id: number) => {
    await fetch(`/api/admin/outbound-hub/contacts/${id}/next-step`, { method: 'POST' });
    fetchContacts();
  };

  const compose = async () => {
    setComposing(true); setComposedMsg(null);
    const res = await fetch('/api/admin/outbound-hub/compose', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copilot),
    }).catch(() => null);
    if (res?.ok) { const d = await res.json(); setComposedMsg(d); }
    setComposing(false);
  };

  const testBot = async () => {
    if (!selectedBot || !testMessage) return;
    setTesting(true); setTestResponse(null);
    const res = await fetch(`/api/admin/outbound-hub/chatbot/${selectedBot}/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: testMessage }),
    }).catch(() => null);
    if (res?.ok) { const d = await res.json(); setTestResponse(d); }
    setTesting(false);
  };

  const activeSeqs = sequences.filter(s => s.status === 'active').length;
  const pausedSeqs = sequences.filter(s => s.status === 'paused').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-2xl font-bold">Outbound Hub</h1>
        <p className="text-slate-300 text-sm mt-1">Outbound Sales · AI Copilot · Personalized Outreach · Conversational AI</p>
      </div>
      <div className="border-b bg-white px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="p-6">
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {loading ? <p className="text-gray-500 text-sm">Loading...</p> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Active Sequences" value={activeSeqs} color="green" />
                  <KpiCard label="Paused Sequences" value={pausedSeqs} color="amber" />
                  <KpiCard label="Contacts Enrolled" value={contactStats?.active || 0} sub={`${contactStats?.completed || 0} completed`} color="blue" />
                  <KpiCard label="Messages Sent" value={messageStats?.sent || 0} sub={`${messageStats?.total || 0} total`} color="purple" />
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h2 className="font-semibold text-gray-700 mb-3">Active Sequences</h2>
                  <div className="space-y-3">
                    {sequences.map(seq => (
                      <div key={seq.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                        <div>
                          <div className="font-medium text-gray-800">{seq.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{seq.steps?.length || 0} steps · {seq.type}</div>
                        </div>
                        <Badge label={seq.status} colorClass={STATUS_COLORS[seq.status] || 'bg-gray-100 text-gray-600'} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'sequences' && (
          <div className="space-y-4">
            {sequences.map(seq => (
              <div key={seq.id} className="bg-white rounded-lg border p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{seq.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">Type: {seq.type}</p>
                  </div>
                  <Badge label={seq.status} colorClass={STATUS_COLORS[seq.status] || 'bg-gray-100 text-gray-600'} />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {(seq.steps || []).map((step, i) => (
                    <div key={i} className="min-w-56 bg-gray-50 border rounded p-3 text-xs flex-shrink-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-gray-700">Step {step.step}</span>
                        <Badge label={step.channel} colorClass={CHANNEL_COLORS[step.channel] || 'bg-gray-100 text-gray-600'} />
                      </div>
                      <div className="text-gray-500">Day {step.day}</div>
                      <div className="font-medium text-gray-700 mt-1">{step.subject}</div>
                      <div className="text-gray-400 mt-1 line-clamp-2">{step.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'contacts' && (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr className="text-left text-gray-500">
                <th className="px-4 py-3">Contact</th><th className="px-4">Company</th>
                <th className="px-4">Sequence</th><th className="px-4">Step</th>
                <th className="px-4">Status</th><th className="px-4">Last Sent</th><th className="px-4">Actions</th>
              </tr></thead>
              <tbody>{contacts.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}<div className="text-xs text-gray-400">{c.email}</div></td>
                  <td className="px-4">{c.company || '—'}</td>
                  <td className="px-4 text-xs text-gray-600">{c.sequence_name || '—'}</td>
                  <td className="px-4 text-center">{c.step_index}</td>
                  <td className="px-4"><Badge label={c.status} colorClass={STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-4 text-xs text-gray-400">{c.last_sent ? new Date(c.last_sent).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4">
                    {c.status === 'active' && (
                      <button onClick={() => advanceContact(c.id)} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200">Next Step</button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {tab === 'copilot' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-700 mb-4">AI Sales Copilot — Personalized Message Composer</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div><label className="text-sm text-gray-600">Contact Name</label>
                    <input value={copilot.name} onChange={e => setCopilot(p => ({ ...p, name: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full mt-1" placeholder="e.g. Sarah Johnson" /></div>
                  <div><label className="text-sm text-gray-600">Company</label>
                    <input value={copilot.company} onChange={e => setCopilot(p => ({ ...p, company: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full mt-1" placeholder="e.g. TechCorp" /></div>
                  <div><label className="text-sm text-gray-600">Role / Title</label>
                    <input value={copilot.role} onChange={e => setCopilot(p => ({ ...p, role: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full mt-1" placeholder="e.g. VP of Marketing" /></div>
                  <div><label className="text-sm text-gray-600">Industry</label>
                    <input value={copilot.industry} onChange={e => setCopilot(p => ({ ...p, industry: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full mt-1" placeholder="e.g. SaaS" /></div>
                  <div><label className="text-sm text-gray-600">Pain Point</label>
                    <input value={copilot.pain_point} onChange={e => setCopilot(p => ({ ...p, pain_point: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full mt-1" placeholder="e.g. scaling their marketing team" /></div>
                  <div><label className="text-sm text-gray-600">Channel</label>
                    <select value={copilot.channel} onChange={e => setCopilot(p => ({ ...p, channel: e.target.value }))}
                      className="border rounded px-3 py-2 text-sm w-full mt-1">
                      <option value="email">Email</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="sms">SMS</option>
                    </select></div>
                  <button onClick={compose} disabled={composing || !copilot.name}
                    className="bg-indigo-600 text-white px-4 py-2 rounded text-sm w-full disabled:opacity-50">
                    {composing ? 'Composing with Ollama...' : 'Compose Personalized Message'}
                  </button>
                </div>
                <div>
                  {composedMsg ? (
                    <div className="bg-gray-50 border rounded p-4 h-full">
                      {composedMsg.subject && <div className="mb-2"><span className="text-xs font-semibold text-gray-500 uppercase">Subject</span><p className="text-sm font-medium text-gray-800 mt-1">{composedMsg.subject}</p></div>}
                      <div><span className="text-xs font-semibold text-gray-500 uppercase">Message</span><p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{composedMsg.body}</p></div>
                      <button onClick={() => navigator.clipboard?.writeText(composedMsg.body)} className="mt-3 text-xs bg-gray-800 text-white px-3 py-1 rounded">Copy</button>
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded p-8 flex items-center justify-center text-gray-400 text-sm h-full">
                      Fill in contact details and click Compose
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'chatbot' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chatbots.map(bot => (
                <div key={bot.id} className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${selectedBot === bot.id ? 'ring-2 ring-indigo-500' : 'hover:shadow-md'}`}
                  onClick={() => setSelectedBot(bot.id)}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-gray-800">{bot.name}</h3>
                    <Badge label={bot.status} colorClass={bot.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} />
                  </div>
                  {bot.persona && <p className="text-xs text-gray-600 mb-1"><span className="font-medium">Persona:</span> {bot.persona}</p>}
                  {bot.channels?.length ? <div className="flex gap-1 mt-2">{bot.channels.map(ch => <Badge key={ch} label={ch} colorClass="bg-blue-50 text-blue-600" />)}</div> : null}
                  {bot.instructions && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{bot.instructions}</p>}
                </div>
              ))}
            </div>
            {selectedBot && (
              <div className="bg-white rounded-lg border p-4">
                <h2 className="font-semibold text-gray-700 mb-3">Test Chatbot Response</h2>
                <div className="flex gap-2">
                  <input value={testMessage} onChange={e => setTestMessage(e.target.value)}
                    placeholder="Type a test message..." className="border rounded px-3 py-2 text-sm flex-1" />
                  <button onClick={testBot} disabled={testing || !testMessage}
                    className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                    {testing ? 'Testing...' : 'Send'}
                  </button>
                </div>
                {testResponse && (
                  <div className="mt-4 bg-gray-50 border rounded p-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{testResponse.response}</p>
                    <p className="text-xs text-gray-400 mt-2">Response time: {testResponse.latency_ms}ms · Model: llama3.2</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
