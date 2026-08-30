'use client';
// /admin/chatgpt-feedback — real 2-way communication with ChatGPT via the
// official OpenAI API. Send a query, get a real response back. Requires an
// OpenAI API key saved at /admin/config/credentials first (portal "openai").
//
// Deliberately NOT browser automation of chatgpt.com — that has no supported
// API and would violate ChatGPT's consumer terms of service.

import { useState } from 'react';

export default function ChatGptFeedbackPage() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAsk() {
    setBusy(true);
    setError(null);
    setResponse(null);
    const res = await fetch('/api/admin/chatgpt-feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setResponse(body.response);
    else setError(body.error ?? 'Request failed.');
    setBusy(false);
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ChatGPT Feedback</h1>
        <p className="text-sm text-gray-500">
          Real 2-way communication with ChatGPT via the official OpenAI API — send a query, get a real response.
          Requires an API key saved at <a href="/admin/config/credentials" className="underline">Credential Vault</a> ("OpenAI (ChatGPT API)").
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Query</label>
        <textarea
          value={query} onChange={e => setQuery(e.target.value)} rows={5}
          placeholder="Ask ChatGPT for feedback on something..."
          className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
        />
        <button onClick={handleAsk} disabled={busy || !query.trim()}
          className="rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? 'Asking…' : 'Ask ChatGPT'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-5">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {response && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Response</p>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{response}</p>
        </div>
      )}
    </div>
  );
}
