'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnvVar {
  key: string;
  set: boolean;
  masked: string | null;
}

interface Integration {
  id: string;
  name: string;
  emoji: string;
  category: string;
  priority: string;
  devPortalUrl: string | null;
  docsUrl: string | null;
  vars: EnvVar[];
  webhookUrl: string | null;
  ollamaCheck?: boolean;
  steps: string[];
}

interface StatusData {
  integrations: Integration[];
  ollamaRunning: boolean;
  summary: {
    total: number;
    fullyConfigured: number;
    partiallyConfigured: number;
    notConfigured: number;
  };
}

type TabId = 'overview' | 'configure' | 'envfile' | 'webhooks';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'configure', label: 'Configure' },
  { id: 'envfile', label: 'Env File Generator' },
  { id: 'webhooks', label: 'Webhooks' },
];

const PRIORITY_ORDER = ['high', 'medium', 'low'];

const CATEGORY_COLORS: Record<string, string> = {
  communication: 'bg-blue-100 text-blue-700',
  storage: 'bg-purple-100 text-purple-700',
  advertising: 'bg-orange-100 text-orange-700',
  social: 'bg-pink-100 text-pink-700',
  scheduling: 'bg-teal-100 text-teal-700',
  payments: 'bg-green-100 text-green-700',
  ai: 'bg-indigo-100 text-indigo-700',
  data: 'bg-gray-100 text-gray-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-500',
};

const QUICK_START_ORDER = [
  'ollama', 'smtp', 'stripe', 'gmail', 'whatsapp', 'twilio',
  'google_drive', 'calcom', 'linkedin', 'youtube', 'google_ads', 'serpapi',
];

const WEBHOOK_ROWS = [
  { integration: 'WhatsApp', path: '/api/admin/communications/webhooks/whatsapp', method: 'GET+POST', configureAt: 'Meta App Dashboard' },
  { integration: 'Twilio SMS', path: '/api/admin/communications/webhooks/twilio', method: 'POST', configureAt: 'Twilio Console' },
  { integration: 'Stripe', path: '/api/payments/webhook', method: 'POST', configureAt: 'Stripe Dashboard' },
  { integration: 'Cal.com', path: '/api/admin/calendar-integration/webhook', method: 'POST', configureAt: 'Cal.com Settings' },
  { integration: 'GitHub', path: '/api/webhooks/github', method: 'POST', configureAt: 'GitHub Repo Settings' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIntegrationStatus(integration: Integration, ollamaRunning: boolean): 'full' | 'partial' | 'none' {
  if (integration.id === 'ollama') return ollamaRunning ? 'full' : 'none';
  if (integration.vars.length === 0) return 'none';
  const setCount = integration.vars.filter(v => v.set).length;
  if (setCount === integration.vars.length) return 'full';
  if (setCount > 0) return 'partial';
  return 'none';
}

function StatusDot({ status }: { status: 'full' | 'partial' | 'none' }) {
  const colors = { full: 'bg-green-500', partial: 'bg-amber-400', none: 'bg-red-400' };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]} flex-shrink-0`} />;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-gray-700 font-medium transition-colors"
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCards({ data }: { data: StatusData }) {
  const { summary, ollamaRunning } = data;
  const cards = [
    { label: 'Fully Configured', value: summary.fullyConfigured, color: 'border-green-500 bg-green-50', textColor: 'text-green-700', icon: '✅' },
    { label: 'Partial', value: summary.partiallyConfigured, color: 'border-amber-400 bg-amber-50', textColor: 'text-amber-700', icon: '⚠️' },
    { label: 'Not Set Up', value: summary.notConfigured, color: 'border-red-400 bg-red-50', textColor: 'text-red-700', icon: '❌' },
    { label: 'Ollama', value: ollamaRunning ? 'Running' : 'Offline', color: ollamaRunning ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50', textColor: ollamaRunning ? 'text-indigo-700' : 'text-gray-500', icon: '🤖' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map(card => (
        <div key={card.label} className={`rounded-lg border-l-4 p-4 ${card.color}`}>
          <div className="text-xl mb-1">{card.icon}</div>
          <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
          <p className="text-sm text-gray-500">{card.label}</p>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ data }: { data: StatusData }) {
  const { summary } = data;
  const pct = Math.round((summary.fullyConfigured / summary.total) * 100);
  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>{summary.fullyConfigured} of {summary.total} integrations configured</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-3 bg-blue-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function OverviewTab({ data, onGoToConfigure }: { data: StatusData; onGoToConfigure: (id: string) => void }) {
  const byId: Record<string, Integration> = {};
  data.integrations.forEach(i => { byId[i.id] = i; });

  const highPriority = data.integrations.filter(i => i.priority === 'high').sort((a, b) =>
    PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
  );

  return (
    <div>
      <SummaryCards data={data} />
      <ProgressBar data={data} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Priority Checklist */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>🔴</span> High Priority Integrations
          </h3>
          <div className="space-y-2">
            {highPriority.map(intg => {
              const status = getIntegrationStatus(intg, data.ollamaRunning);
              return (
                <div key={intg.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                  <StatusDot status={status} />
                  <span className="text-lg">{intg.emoji}</span>
                  <span className="flex-1 text-sm text-gray-700">{intg.name}</span>
                  <button
                    onClick={() => onGoToConfigure(intg.id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Configure →
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span>🚀</span> Recommended Setup Order
          </h3>
          <ol className="space-y-2">
            {QUICK_START_ORDER.map((id, idx) => {
              const intg = byId[id];
              if (!intg) return null;
              const status = getIntegrationStatus(intg, data.ollamaRunning);
              const statusLabel = status === 'full' ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Done</span>
              ) : status === 'partial' ? (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Partial</span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Not set</span>
              );
              return (
                <li key={id} className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-base">{intg.emoji}</span>
                  <button
                    onClick={() => onGoToConfigure(id)}
                    className="flex-1 text-left text-sm text-gray-700 hover:text-blue-700"
                  >
                    {intg.name}
                  </button>
                  {statusLabel}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

function ConfigureTab({ data }: { data: StatusData; selectedId?: string }) {
  const [selectedId, setSelectedId] = useState<string>(data.integrations[0]?.id ?? '');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; models?: string[] } | null>(null);
  const [testing, setTesting] = useState(false);
  const [snippetText, setSnippetText] = useState('');
  const [loadingSnippet, setLoadingSnippet] = useState(false);

  const selected = data.integrations.find(i => i.id === selectedId);

  const handleTest = async () => {
    if (!selected) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/setup/test/${selected.id}`, { method: 'POST' });
      const json = await res.json() as { ok: boolean; message: string; models?: string[] };
      setTestResult(json);
    } catch (e) {
      setTestResult({ ok: false, message: `Error: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setTesting(false);
    }
  };

  const handleCopySnippet = async () => {
    if (!selected) return;
    setLoadingSnippet(true);
    setSnippetText('');
    try {
      const vals: Record<string, string> = {};
      selected.vars.forEach(v => {
        vals[v.key] = inputValues[v.key] ?? '';
      });
      const res = await fetch('/api/admin/setup/env-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: vals }),
      });
      const json = await res.json() as { content: string };
      setSnippetText(json.content ?? '');
    } catch (e) {
      setSnippetText(`# Error generating snippet: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingSnippet(false);
    }
  };

  if (!selected) return null;

  const status = getIntegrationStatus(selected, data.ollamaRunning);
  const setCount = selected.id === 'ollama'
    ? (data.ollamaRunning ? 1 : 0)
    : selected.vars.filter(v => v.set).length;
  const totalCount = selected.id === 'ollama' ? 1 : selected.vars.length;

  return (
    <div className="flex gap-4 min-h-96">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 bg-white rounded-lg border border-gray-200 overflow-y-auto">
        {data.integrations.map(intg => {
          const st = getIntegrationStatus(intg, data.ollamaRunning);
          const isActive = intg.id === selectedId;
          return (
            <button
              key={intg.id}
              onClick={() => { setSelectedId(intg.id); setTestResult(null); setSnippetText(''); }}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2 border-b border-gray-100 hover:bg-gray-50 transition-colors ${isActive ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}
            >
              <StatusDot status={st} />
              <span className="text-sm">{intg.emoji}</span>
              <span className={`text-sm truncate ${isActive ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{intg.name}</span>
            </button>
          );
        })}
      </div>

      {/* Right Panel */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 p-5 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">{selected.emoji}</span>
              {selected.name}
            </h2>
            <div className="flex gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[selected.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {selected.category}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[selected.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                {selected.priority} priority
              </span>
            </div>
          </div>
          <div className={`text-sm font-medium px-3 py-1 rounded-full ${status === 'full' ? 'bg-green-100 text-green-700' : status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            {selected.id === 'ollama'
              ? (data.ollamaRunning ? 'Running' : 'Offline')
              : `${setCount} / ${totalCount} vars set`}
          </div>
        </div>

        {/* Env Var Rows */}
        {selected.vars.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Environment Variables</h3>
            <div className="space-y-2">
              {selected.vars.map(v => (
                <div key={v.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-gray-700 bg-gray-200 px-1.5 py-0.5 rounded">{v.key}</code>
                      {v.set
                        ? <span className="text-xs text-green-600 font-medium">✓ set ({v.masked})</span>
                        : <span className="text-xs text-red-500 font-medium">✗ not set</span>
                      }
                    </div>
                  </div>
                  <input
                    type="password"
                    placeholder={v.set ? 'Leave blank to keep existing' : 'Enter value'}
                    value={inputValues[v.key] ?? ''}
                    onChange={e => setInputValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                    className="w-64 text-xs border border-gray-300 rounded px-2 py-1.5 font-mono focus:outline-none focus:border-blue-400"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {selected.id === 'ollama' && (
          <div className={`mb-5 p-3 rounded-lg border ${data.ollamaRunning ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-sm font-medium ${data.ollamaRunning ? 'text-green-700' : 'text-red-700'}`}>
              {data.ollamaRunning
                ? '✓ Ollama is running at http://localhost:11434 — no env vars needed.'
                : '✗ Ollama is not reachable. Follow the steps below to start it.'}
            </p>
          </div>
        )}

        {/* Setup Steps */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Setup Steps</h3>
          <ol className="space-y-1.5">
            {selected.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-600">
                <span className="w-5 h-5 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Links */}
        <div className="flex gap-2 mb-5">
          {selected.devPortalUrl && (
            <a
              href={selected.devPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Developer Portal →
            </a>
          )}
          {selected.docsUrl && (
            <a
              href={selected.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors"
            >
              Documentation →
            </a>
          )}
        </div>

        {/* Webhook URL */}
        {selected.webhookUrl && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Webhook URL</h3>
            <div className="flex items-center gap-2 bg-gray-900 rounded px-3 py-2">
              <code className="flex-1 text-green-400 text-xs font-mono">{selected.webhookUrl}</code>
              <CopyButton text={selected.webhookUrl} />
            </div>
          </div>
        )}

        {/* Test Connection */}
        <div className="mb-5">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {testResult && (
            <div className={`mt-3 p-3 rounded-lg border text-sm ${testResult.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <p className="font-medium">{testResult.ok ? '✓ Success' : '✗ Failed'}</p>
              <p>{testResult.message}</p>
              {testResult.models && testResult.models.length > 0 && (
                <p className="text-xs mt-1">Models: {testResult.models.join(', ')}</p>
              )}
            </div>
          )}
        </div>

        {/* Copy Snippet */}
        {selected.vars.length > 0 && (
          <div>
            <button
              onClick={handleCopySnippet}
              disabled={loadingSnippet}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
            >
              {loadingSnippet ? 'Generating...' : 'Copy .env.local Snippet'}
            </button>
            {snippetText && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Add these to your .env.local file:</span>
                  <CopyButton text={snippetText} label="Copy All" />
                </div>
                <textarea
                  readOnly
                  value={snippetText}
                  rows={8}
                  className="w-full text-xs font-mono border border-gray-300 rounded p-2 bg-gray-50 focus:outline-none resize-y"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EnvFileTab({ data }: { data: StatusData }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(data.integrations.map(i => i.id)));
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [generatedContent, setGeneratedContent] = useState('');
  const [generating, setGenerating] = useState(false);

  const selectedIntegrations = data.integrations.filter(i => selectedIds.has(i.id) && i.vars.length > 0);

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedContent('');
    try {
      const values: Record<string, string> = {};
      selectedIntegrations.forEach(intg => {
        intg.vars.forEach(v => {
          values[v.key] = inputValues[v.key] ?? '';
        });
      });
      const res = await fetch('/api/admin/setup/env-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      });
      const json = await res.json() as { content: string };
      setGeneratedContent(json.content ?? '');
    } catch (e) {
      setGeneratedContent(`# Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([generatedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env.local';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleAll = (val: boolean) => {
    setSelectedIds(val ? new Set(data.integrations.map(i => i.id)) : new Set());
  };

  return (
    <div>
      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6 flex gap-3">
        <span className="text-amber-500 text-xl flex-shrink-0">⚠️</span>
        <div>
          <p className="font-semibold text-amber-800">Never commit .env.local to git.</p>
          <p className="text-sm text-amber-700">This file contains API keys and secrets. Make sure <code className="bg-amber-100 px-1 rounded">.env.local</code> is in your <code className="bg-amber-100 px-1 rounded">.gitignore</code>.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Selection + Inputs */}
        <div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Select Integrations</h3>
              <div className="flex gap-2">
                <button onClick={() => toggleAll(true)} className="text-xs text-blue-600 hover:underline">All</button>
                <span className="text-gray-300">|</span>
                <button onClick={() => toggleAll(false)} className="text-xs text-gray-500 hover:underline">None</button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {data.integrations.map(intg => {
                if (intg.vars.length === 0) return null;
                const status = getIntegrationStatus(intg, data.ollamaRunning);
                return (
                  <label key={intg.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(intg.id)}
                      onChange={e => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(intg.id); else next.delete(intg.id);
                        setSelectedIds(next);
                      }}
                      className="rounded"
                    />
                    <span>{intg.emoji}</span>
                    <span className="text-sm text-gray-700 flex-1">{intg.name}</span>
                    {status === 'full'
                      ? <span className="text-xs text-green-600">🔒 configured</span>
                      : status === 'partial'
                        ? <span className="text-xs text-amber-600">partial</span>
                        : null
                    }
                  </label>
                );
              })}
            </div>
          </div>

          {/* Input Fields */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Enter Values</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {selectedIntegrations.map(intg => (
                <div key={intg.id}>
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-sm">{intg.emoji}</span>
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{intg.name}</span>
                  </div>
                  {intg.vars.map(v => (
                    <div key={v.key} className="flex items-center gap-2 mb-1.5">
                      <code className="text-xs font-mono text-gray-500 w-48 truncate flex-shrink-0">{v.key}</code>
                      {v.set && <span className="text-xs text-green-600 flex-shrink-0">🔒</span>}
                      <input
                        type="password"
                        placeholder={v.set ? 'Already set' : 'Enter value'}
                        value={inputValues[v.key] ?? ''}
                        onChange={e => setInputValues(prev => ({ ...prev, [v.key]: e.target.value }))}
                        className="flex-1 min-w-0 text-xs border border-gray-300 rounded px-2 py-1 font-mono focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  ))}
                </div>
              ))}
              {selectedIntegrations.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Select integrations above to enter values.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Generated Output */}
        <div>
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleGenerate}
              disabled={generating || selectedIntegrations.length === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {generating ? 'Generating...' : 'Generate .env.local'}
            </button>
            {generatedContent && (
              <>
                <CopyButton text={generatedContent} label="Copy All" />
                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Download
                </button>
              </>
            )}
          </div>
          <textarea
            readOnly
            value={generatedContent || '# Click "Generate .env.local" to produce output'}
            rows={24}
            className="w-full text-xs font-mono border border-gray-300 rounded p-3 bg-gray-50 focus:outline-none resize-y"
          />
        </div>
      </div>
    </div>
  );
}

function WebhooksTab() {
  const [baseUrl, setBaseUrl] = useState('');
  const [pingResults, setPingResults] = useState<Record<string, string>>({});
  const [pinging, setPinging] = useState<string | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
    setBaseUrl(url);
  }, []);

  const handlePing = async (path: string) => {
    setPinging(path);
    setPingResults(prev => ({ ...prev, [path]: 'Pinging...' }));
    try {
      const fullUrl = baseUrl.replace(/\/$/, '') + path;
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ping' }),
        signal: AbortSignal.timeout(5000),
      });
      setPingResults(prev => ({ ...prev, [path]: `HTTP ${res.status} ${res.statusText}` }));
    } catch (e) {
      setPingResults(prev => ({ ...prev, [path]: `Error: ${e instanceof Error ? e.message : String(e)}` }));
    } finally {
      setPinging(null);
    }
  };

  return (
    <div>
      {/* Base URL */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Your Base URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400"
            placeholder="https://yourdomain.com"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Pre-filled from NEXT_PUBLIC_API_URL or current window origin.</p>
      </div>

      {/* Webhooks Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold">Integration</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold">Webhook URL</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold">Method</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold">Configure At</th>
              <th className="text-left px-4 py-3 text-gray-600 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {WEBHOOK_ROWS.map(row => {
              const fullUrl = (baseUrl.replace(/\/$/, '') + row.path);
              return (
                <tr key={row.path} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{row.integration}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">{row.path}</code>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded truncate max-w-xs">{fullUrl}</code>
                      <CopyButton text={fullUrl} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{row.method}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.configureAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePing(row.path)}
                        disabled={pinging === row.path}
                        className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        {pinging === row.path ? '...' : 'Test'}
                      </button>
                      {pingResults[row.path] && (
                        <span className={`text-xs ${pingResults[row.path].startsWith('Error') ? 'text-red-600' : 'text-gray-600'}`}>
                          {pingResults[row.path]}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SetupWizardPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [configureTargetId, setConfigureTargetId] = useState<string | undefined>(undefined);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/setup/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as StatusData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleGoToConfigure = (id: string) => {
    setConfigureTargetId(id);
    setActiveTab('configure');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading integration status...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700 font-semibold">Failed to load setup status</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <button onClick={fetchStatus} className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integration Setup Center</h1>
            <p className="text-sm text-gray-500 mt-0.5">Configure third-party services, API keys, and webhooks for this platform.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-bold text-blue-700">{summary.fullyConfigured}</span> / {summary.total} configured
            </div>
            <button
              onClick={fetchStatus}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-screen-xl mx-auto flex gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <OverviewTab data={data} onGoToConfigure={handleGoToConfigure} />
        )}
        {activeTab === 'configure' && (
          <ConfigureTab data={data} selectedId={configureTargetId} />
        )}
        {activeTab === 'envfile' && (
          <EnvFileTab data={data} />
        )}
        {activeTab === 'webhooks' && (
          <WebhooksTab />
        )}
      </div>
    </div>
  );
}
