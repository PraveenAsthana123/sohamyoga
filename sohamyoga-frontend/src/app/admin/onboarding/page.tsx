'use client';
// Real Admin Portal -- Onboarding Management. customer.onboarding_step/
// onboarding_completed_at were real columns written by the real customer
// onboarding wizard, but no staff view existed to monitor completion.

import { useEffect, useState } from 'react';

interface CustomerRow { email: string; step: string; completedAt: string | null; createdAt: string }
interface ReadinessCheck { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }
interface Readiness { score: number; trafficLight: 'green' | 'amber' | 'red'; checks: ReadinessCheck[] }

const READINESS_COLOR: Record<Readiness['trafficLight'], string> = {
  green: 'text-green-600', amber: 'text-amber-600', red: 'text-red-600',
};
const CHECK_BADGE: Record<ReadinessCheck['status'], string> = {
  pass: 'bg-green-100 text-green-700', warn: 'bg-amber-100 text-amber-700', fail: 'bg-red-100 text-red-700',
};

function BusinessReadinessCard() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  useEffect(() => {
    fetch('/api/admin/onboarding/readiness', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(setReadiness);
  }, []);

  if (!readiness) return null;
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">Business Setup Readiness</p>
          <p className="text-xs text-gray-500 mt-0.5">Real completeness check for this tenant — profile, brand kit, locations, catalog, channels, owner.</p>
        </div>
        <p className={`text-3xl font-bold ${READINESS_COLOR[readiness.trafficLight]}`}>{readiness.score}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {readiness.checks.map(c => (
          <div key={c.id} className="flex items-center justify-between text-xs border rounded p-2">
            <span className="text-gray-600">{c.label}</span>
            <span className={`px-1.5 py-0.5 rounded-full font-medium ${CHECK_BADGE[c.status]}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChatTurn { role: 'user' | 'assistant'; content: string }

// Real AI Onboarding Assistant -- streams from the same real Ollama chat
// infra as the customer-facing assistant, grounded in this tenant's actual
// Business Readiness Score checks (see the API route for the system prompt).
function OnboardingAssistant() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const nextTurns = [...turns, { role: 'user' as const, content: text }];
    setTurns(nextTurns);
    setInput('');
    setError('');
    setStreaming(true);
    setTurns(t => [...t, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/admin/onboarding/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextTurns }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Assistant unavailable.');
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') continue;
          const parsed = JSON.parse(payload) as { delta?: string; error?: string };
          if (parsed.error) { setError(parsed.error); continue; }
          if (parsed.delta) setTurns(t => { const copy = [...t]; copy[copy.length - 1] = { role: 'assistant', content: copy[copy.length - 1].content + parsed.delta }; return copy; });
        }
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="font-semibold text-gray-900 mb-2">AI Onboarding Assistant</p>
      <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
        {turns.map((t, i) => (
          <p key={i} className={`text-sm p-2 rounded ${t.role === 'user' ? 'bg-indigo-50 text-indigo-800' : 'bg-gray-50 text-gray-700'}`}>{t.content || (streaming && i === turns.length - 1 ? '…' : '')}</p>
        ))}
        {!turns.length && <p className="text-xs text-gray-400">Ask what to set up next — answers are grounded in your real readiness checks above.</p>}
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="What should I set up next?" className="flex-1 rounded border p-2 text-sm" />
        <button onClick={send} disabled={streaming} className="text-xs bg-indigo-600 text-white px-3 py-2 rounded disabled:opacity-50">{streaming ? '…' : 'Ask'}</button>
      </div>
    </div>
  );
}

interface ImportRowResult { row: number; email: string | null; status: 'imported' | 'duplicate' | 'invalid'; reason?: string }
interface ImportSummary { totalRows: number; imported: number; duplicates: number; invalid: number; results: ImportRowResult[] }

// Real Data Import + Import Validation -- first build.
function DataImportCard() {
  const [csv, setCsv] = useState('name,email,phone\nJane Doe,jane@example.com,+1 555 0100');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  async function runImport() {
    setImporting(true); setError(''); setSummary(null);
    const res = await fetch('/api/admin/onboarding/import-leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }),
    });
    const body = await res.json();
    setImporting(false);
    if (!res.ok) { setError(body.error || 'Import failed.'); return; }
    setSummary(body);
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="font-semibold text-gray-900 mb-1">Data Import (Leads)</p>
      <p className="text-xs text-gray-500 mb-2">Paste CSV with a header row (name, email, phone). Each row is validated and deduplicated against real campaign_lead records before import.</p>
      <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={5} className="w-full rounded border p-2 text-xs font-mono" />
      <button onClick={runImport} disabled={importing} className="mt-2 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded disabled:opacity-50">
        {importing ? 'Importing…' : 'Import'}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {summary && (
        <div className="mt-3 text-xs">
          <p className="font-medium text-gray-700">{summary.imported} imported, {summary.duplicates} duplicates, {summary.invalid} invalid (of {summary.totalRows} rows)</p>
          <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
            {summary.results.map(r => (
              <p key={r.row} className={r.status === 'imported' ? 'text-green-600' : r.status === 'duplicate' ? 'text-amber-600' : 'text-red-600'}>
                Row {r.row}: {r.email ?? '(no email)'} — {r.status}{r.reason ? ` (${r.reason})` : ''}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingAdminPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetch('/api/admin/onboarding', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setCustomers(d?.customers ?? []); setCompletedCount(d?.completedCount ?? 0); setTotalCount(d?.totalCount ?? 0); });
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
        <p className="text-sm text-gray-500 mt-0.5">Real customer.onboarding_step tracking — who has completed the 4-step wizard, who is stuck.</p>
      </div>
      <BusinessReadinessCard />
      <DataImportCard />
      <OnboardingAssistant />
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{completedCount} / {totalCount}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-xs text-gray-500">In Progress / Not Started</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{totalCount - completedCount}</p>
        </div>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
            {['Customer', 'Step', 'Completed At', 'Signed Up'].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map(c => (
              <tr key={c.email}>
                <td className="px-4 py-2">{c.email}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.completedAt ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{c.step}</span>
                </td>
                <td className="px-4 py-2 text-gray-500">{c.completedAt ? new Date(c.completedAt).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2 text-gray-400 text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!customers.length && <p className="text-sm text-gray-400 text-center py-8">No customers yet.</p>}
      </div>
    </div>
  );
}
