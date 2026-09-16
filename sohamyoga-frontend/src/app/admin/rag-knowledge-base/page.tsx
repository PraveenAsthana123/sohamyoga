'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'System Status' | 'Knowledge Base' | 'Semantic Search' | 'AI Q&A' | 'Query History';
const TABS: Tab[] = ['System Status', 'Knowledge Base', 'Semantic Search', 'AI Q&A', 'Query History'];

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
interface RagStatus {
  pgvector_installed: boolean;
  embedding_model_available: boolean;
  document_count: number;
  chunk_count: number;
  query_count: number;
  ready: boolean;
  ollama_base?: string;
  error?: string;
}

interface RagDocument {
  id: number;
  source_id: string;
  source_type: string;
  title: string;
  content_length: number;
  chunk_count: number;
  status: string;
  created_at: string;
}

interface SearchResult {
  chunk_text: string;
  title: string;
  source_type: string;
  similarity: number;
}

interface AskResult {
  answer: string;
  sources: Array<{ title: string; similarity: number; source_type: string }>;
  query_id: number | null;
  elapsed_ms: number;
}

interface QueryRecord {
  id: number;
  question: string;
  answer: string;
  sources_used: number;
  avg_similarity: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full mr-2 ${ok ? 'bg-green-500' : 'bg-red-500'}`}
    />
  );
}

function sourceTypeBadge(t: string) {
  const map: Record<string, string> = {
    text: 'bg-blue-100 text-blue-800',
    url: 'bg-purple-100 text-purple-800',
    pdf: 'bg-orange-100 text-orange-800',
    note: 'bg-gray-100 text-gray-800',
  };
  return map[t] ?? 'bg-gray-100 text-gray-800';
}

function simPct(s: number) {
  return `${(s * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Sub-panel: System Status
// ---------------------------------------------------------------------------
function SystemStatusPanel() {
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rag/status');
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    const t0 = Date.now();
    try {
      const res = await fetch('/api/admin/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'Hello world — what services do you offer?' }),
      });
      const elapsed = Date.now() - t0;
      if (res.ok) {
        const d = await res.json() as AskResult;
        setTestResult(`OK in ${elapsed}ms — ${d.answer.slice(0, 120)}…`);
      } else {
        const d = await res.json() as { error?: string };
        setTestResult(`Error ${res.status}: ${d.error ?? 'unknown'}`);
      }
    } catch (e) {
      setTestResult(`Exception: ${String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <p className="text-gray-500 py-8 text-center">Loading system status…</p>;
  if (!status) return <p className="text-red-600 py-8 text-center">Failed to load status.</p>;

  return (
    <div className="space-y-6">
      {/* Health cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">pgvector Extension</div>
          <div className="flex items-center font-semibold">
            <StatusDot ok={status.pgvector_installed} />
            {status.pgvector_installed ? 'Installed' : 'Not Installed'}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">nomic-embed-text</div>
          <div className="flex items-center font-semibold">
            <StatusDot ok={status.embedding_model_available} />
            {status.embedding_model_available ? 'Available' : 'Not Pulled'}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Overall Readiness</div>
          <div className="flex items-center font-semibold">
            <StatusDot ok={status.ready} />
            {status.ready ? 'Ready' : 'Not Ready'}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Documents</div>
          <div className="text-2xl font-bold text-blue-700">{status.document_count}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Chunks (Vectors)</div>
          <div className="text-2xl font-bold text-purple-700">{status.chunk_count}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Queries Run</div>
          <div className="text-2xl font-bold text-green-700">{status.query_count}</div>
        </div>
      </div>

      {/* Setup guide */}
      {!status.ready && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 space-y-3">
          <h3 className="font-semibold text-yellow-900">Setup Guide</h3>
          {!status.pgvector_installed && (
            <div>
              <p className="text-yellow-800 text-sm mb-1">
                pgvector is not installed. Run in PostgreSQL as a superuser:
              </p>
              <code className="block bg-yellow-100 text-yellow-900 text-xs font-mono px-3 py-2 rounded">
                CREATE EXTENSION vector;
              </code>
            </div>
          )}
          {!status.embedding_model_available && (
            <div>
              <p className="text-yellow-800 text-sm mb-1">
                nomic-embed-text model is not available in Ollama. Pull it with:
              </p>
              <code className="block bg-yellow-100 text-yellow-900 text-xs font-mono px-3 py-2 rounded">
                ollama pull nomic-embed-text
              </code>
              {status.ollama_base && (
                <p className="text-yellow-700 text-xs mt-1">Ollama base: {status.ollama_base}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Test button */}
      <div className="bg-white border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-gray-900">End-to-End Test</h3>
        <p className="text-sm text-gray-600">
          Sends a test question through the full RAG pipeline (embed → retrieve → generate) and
          reports latency.
        </p>
        <button
          onClick={() => void runTest()}
          disabled={testing}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {testing ? 'Testing…' : 'Run Test Embedding'}
        </button>
        {testResult && (
          <div className="bg-gray-50 border rounded p-3 text-sm font-mono text-gray-800 whitespace-pre-wrap">
            {testResult}
          </div>
        )}
      </div>

      <button
        onClick={() => void load()}
        className="text-sm text-blue-600 hover:underline"
      >
        Refresh status
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-panel: Knowledge Base
// ---------------------------------------------------------------------------
function KnowledgeBasePanel() {
  const [docs, setDocs] = useState<RagDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', content: '', source_type: 'text' });
  const [urlForm, setUrlForm] = useState({ url: '', title: '' });
  const [submitting, setSubmitting] = useState(false);
  const [urlSubmitting, setUrlSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rag');
      if (res.ok) {
        const d = await res.json() as { documents: RagDocument[] };
        setDocs(d.documents);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDocs(); }, [loadDocs]);

  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json() as { chunks_stored?: number; error?: string };
      if (res.ok) {
        setMsg(`Ingested successfully — ${d.chunks_stored} chunks stored.`);
        setForm({ title: '', content: '', source_type: 'text' });
        setShowAddForm(false);
        void loadDocs();
      } else {
        setMsg(`Error: ${d.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIngestUrl(e: React.FormEvent) {
    e.preventDefault();
    setUrlSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/rag/ingest-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(urlForm),
      });
      const d = await res.json() as { chunks_stored?: number; error?: string };
      if (res.ok) {
        setMsg(`URL ingested — ${d.chunks_stored} chunks stored.`);
        setUrlForm({ url: '', title: '' });
        setShowUrlForm(false);
        void loadDocs();
      } else {
        setMsg(`Error: ${d.error}`);
      }
    } finally {
      setUrlSubmitting(false);
    }
  }

  async function handleDelete(id: number, title: string) {
    if (!confirm(`Delete "${title}"? This also removes all its chunks.`)) return;
    const res = await fetch(`/api/admin/rag/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMsg(`Deleted "${title}".`);
      void loadDocs();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button
          onClick={() => { setShowAddForm(!showAddForm); setShowUrlForm(false); }}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          + Add Document
        </button>
        <button
          onClick={() => { setShowUrlForm(!showUrlForm); setShowAddForm(false); }}
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700"
        >
          Import URL
        </button>
        <button onClick={() => void loadDocs()} className="text-sm text-blue-600 hover:underline ml-auto">
          Refresh
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded text-sm ${msg.startsWith('Error') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
          {msg}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={(e) => void handleAddDoc(e)} className="bg-gray-50 border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Add Document</h3>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={form.source_type}
            onChange={(e) => setForm({ ...form, source_type: e.target.value })}
          >
            <option value="text">Text</option>
            <option value="url">URL Content</option>
            <option value="pdf">PDF</option>
            <option value="note">Note</option>
          </select>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm h-32 resize-y"
            placeholder="Document content…"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Ingesting…' : 'Ingest Document'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-gray-600 text-sm px-3 py-2">
              Cancel
            </button>
          </div>
        </form>
      )}

      {showUrlForm && (
        <form onSubmit={(e) => void handleIngestUrl(e)} className="bg-gray-50 border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Import URL</h3>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="https://example.com/page"
            type="url"
            value={urlForm.url}
            onChange={(e) => setUrlForm({ ...urlForm, url: e.target.value })}
            required
          />
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Optional title"
            value={urlForm.title}
            onChange={(e) => setUrlForm({ ...urlForm, title: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={urlSubmitting}
              className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {urlSubmitting ? 'Fetching…' : 'Fetch & Ingest'}
            </button>
            <button type="button" onClick={() => setShowUrlForm(false)} className="text-gray-600 text-sm px-3 py-2">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-6">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="text-gray-400 text-center py-6">No documents indexed yet. Add one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Title</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Type</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Chunks</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Status</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Indexed</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900 max-w-xs truncate">{doc.title}</td>
                  <td className="px-4 py-2">
                    <Badge label={doc.source_type} color={sourceTypeBadge(doc.source_type)} />
                  </td>
                  <td className="px-4 py-2 text-center">{doc.chunk_count}</td>
                  <td className="px-4 py-2">
                    <Badge
                      label={doc.status}
                      color={doc.status === 'indexed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                    />
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(doc.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => void handleDelete(doc.id, doc.title)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-panel: Semantic Search
// ---------------------------------------------------------------------------
function SemanticSearchPanel() {
  const [query, setQuery] = useState('');
  const [threshold, setThreshold] = useState(0.5);
  const [sourceType, setSourceType] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { query, limit: 10, similarity_threshold: threshold };
      if (sourceType) body.source_types = [sourceType];
      const res = await fetch('/api/admin/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json() as { results?: SearchResult[]; error?: string };
      if (res.ok) {
        setResults(d.results ?? []);
        setSearched(true);
      } else {
        setError(d.error ?? 'Search failed.');
      }
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void handleSearch(e)} className="bg-gray-50 border rounded-lg p-4 space-y-3">
        <input
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Search query…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
        />
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <label>Similarity threshold: {threshold.toFixed(2)}</label>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-32"
            />
          </div>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            <option value="">All types</option>
            <option value="text">text</option>
            <option value="url">url</option>
            <option value="pdf">pdf</option>
            <option value="note">note</option>
          </select>
          <button
            type="submit"
            disabled={searching}
            className="bg-purple-600 text-white px-5 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {error && <div className="bg-red-50 text-red-800 rounded p-3 text-sm">{error}</div>}

      {searched && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">{results.length} result(s) found</p>
          {results.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No results above threshold.</p>
          ) : (
            results.map((r, i) => (
              <div key={i} className="bg-white border rounded-lg p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{r.title}</span>
                  <Badge label={r.source_type} color={sourceTypeBadge(r.source_type)} />
                  <span className="ml-auto text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                    {simPct(r.similarity)} match
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.chunk_text}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-panel: AI Q&A
// ---------------------------------------------------------------------------
function AiQaPanel() {
  const [question, setQuestion] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [asking, setAsking] = useState(false);
  const [lastResult, setLastResult] = useState<AskResult | null>(null);
  const [history, setHistory] = useState<QueryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rag/history?limit=10');
      if (res.ok) {
        const d = await res.json() as { queries: QueryRecord[] };
        setHistory(d.queries);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setError(null);
    try {
      const body: Record<string, string> = { question };
      if (systemPrompt.trim()) body.system_prompt = systemPrompt;
      const res = await fetch('/api/admin/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json() as AskResult & { error?: string };
      if (res.ok) {
        setLastResult(d);
        setQuestion('');
        void loadHistory();
      } else {
        setError(d.error ?? 'Ask failed.');
      }
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void handleAsk(e)} className="bg-gray-50 border rounded-lg p-4 space-y-3">
        <textarea
          className="w-full border rounded px-3 py-2 text-sm h-20 resize-y"
          placeholder="Ask a question about your knowledge base…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={asking}
            className="bg-green-600 text-white px-5 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {asking ? 'Generating answer…' : 'Ask RAG'}
          </button>
          <button
            type="button"
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className="text-gray-500 text-sm hover:text-gray-700"
          >
            {showSystemPrompt ? 'Hide' : 'Customize'} system prompt
          </button>
        </div>
        {showSystemPrompt && (
          <textarea
            className="w-full border rounded px-3 py-2 text-sm h-24 resize-y"
            placeholder="Custom system prompt (optional)…"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        )}
      </form>

      {error && <div className="bg-red-50 text-red-800 rounded p-3 text-sm">{error}</div>}

      {lastResult && (
        <div className="bg-white border rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Answer</h3>
            <span className="text-xs text-gray-500">{lastResult.elapsed_ms}ms</span>
          </div>
          <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{lastResult.answer}</p>
          {lastResult.sources.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Sources used</p>
              <div className="flex flex-wrap gap-2">
                {lastResult.sources.map((s, i) => (
                  <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                    {s.title} ({simPct(s.similarity)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Recent Questions</h3>
          {history.map((q) => (
            <details key={q.id} className="bg-white border rounded-lg group">
              <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800 truncate max-w-md">{q.question}</span>
                <span className="text-gray-400 text-xs ml-2 shrink-0">
                  {new Date(q.created_at).toLocaleTimeString()}
                </span>
              </summary>
              <div className="px-4 pb-3 pt-1 border-t text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {q.answer}
                <div className="text-xs text-gray-400 mt-2">
                  {q.sources_used} sources · avg similarity {(parseFloat(q.avg_similarity) * 100).toFixed(1)}%
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-panel: Query History
// ---------------------------------------------------------------------------
function QueryHistoryPanel() {
  const [records, setRecords] = useState<QueryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/rag/history?page=${p}&limit=20`);
      if (res.ok) {
        const d = await res.json() as { queries: QueryRecord[]; total: number; pages: number };
        setRecords(d.queries);
        setTotal(d.total);
        setPages(d.pages);
        setPage(p);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{total} total queries</p>
        <button onClick={() => void load(page)} className="text-sm text-blue-600 hover:underline">Refresh</button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-6">Loading history…</p>
      ) : records.length === 0 ? (
        <p className="text-gray-400 text-center py-6">No queries yet. Try the AI Q&A tab.</p>
      ) : (
        <>
          <div className="space-y-2">
            {records.map((q) => (
              <details key={q.id} className="bg-white border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer text-sm flex items-start justify-between gap-2">
                  <span className="font-medium text-gray-800 flex-1">{q.question}</span>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                    <span>{q.sources_used} src</span>
                    <span>{(parseFloat(q.avg_similarity) * 100).toFixed(1)}% sim</span>
                    <span>{new Date(q.created_at).toLocaleString()}</span>
                  </div>
                </summary>
                <div className="px-4 pb-3 pt-1 border-t">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{q.answer}</p>
                </div>
              </details>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex gap-2 justify-center text-sm">
              <button
                disabled={page <= 1}
                onClick={() => void load(page - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-gray-600">Page {page} of {pages}</span>
              <button
                disabled={page >= pages}
                onClick={() => void load(page + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function RagKnowledgeBasePage() {
  const [tab, setTab] = useState<Tab>('System Status');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white border rounded-xl p-6">
          <h1 className="text-2xl font-bold text-gray-900">RAG Knowledge Base</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Real Retrieval-Augmented Generation — pgvector cosine similarity + Ollama nomic-embed-text
            (768 dimensions) + llama3.2 generation
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="flex border-b overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === t
                    ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 'System Status' && <SystemStatusPanel />}
            {tab === 'Knowledge Base' && <KnowledgeBasePanel />}
            {tab === 'Semantic Search' && <SemanticSearchPanel />}
            {tab === 'AI Q&A' && <AiQaPanel />}
            {tab === 'Query History' && <QueryHistoryPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
