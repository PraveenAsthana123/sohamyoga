'use client';
import { useEffect, useState, useCallback } from 'react';

// Master Use Case Tracking -- every individual use case pulled from the two
// ChatGPT platform-blueprint conversations, honestly statused against real
// code. Finer-grained than module_registry (which tracks shipped features);
// this tracks the raw backlog of ideas, whether built or not.

interface UseCase {
  id: string; source: string; category: string; domain: string; use_case_key: string;
  title: string; description: string; status: string; evidence: string | null;
  module_registry_key: string | null; priority: string; updated_at: string;
  ai_priority: string | null; ai_buildability: string | null;
  ai_recommendation: string | null; ai_assessed_at: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  transactional_backbone: 'Transactional Backbone',
  marketing_module: 'Marketing Modules',
  domain_control_tower: 'Domain Control Towers',
  ai_governance: 'AI Governance Control Towers',
  career_content: 'Career Content (not a build target)',
};
const STATUS_COLOR: Record<string, string> = {
  real: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  partial: 'bg-amber-100 text-amber-700 border-amber-300',
  not_built: 'bg-red-100 text-red-700 border-red-300',
  blocked: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  n_a: 'bg-gray-100 text-gray-500 border-gray-300',
};
const CATEGORIES = ['transactional_backbone', 'marketing_module', 'domain_control_tower', 'ai_governance', 'career_content'];
const STATUSES = ['real', 'partial', 'not_built', 'blocked', 'n_a'];
const AI_PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700 border-rose-300',
  medium: 'bg-amber-100 text-amber-700 border-amber-300',
  low: 'bg-gray-100 text-gray-500 border-gray-300',
};
const AI_BUILDABILITY_LABEL: Record<string, string> = {
  buildable_now: 'Buildable now',
  needs_new_infra: 'Needs new infra',
  blocked_external: 'Blocked (external)',
};
const AI_PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default function UseCaseRegistryPage() {
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [summary, setSummary] = useState<{ category: string; status: string; count: string }[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortByAiPriority, setSortByAiPriority] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter) params.set('category', categoryFilter);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/admin/usecase-registry?${params}`);
    const data = await res.json();
    setUseCases(data.useCases ?? []);
    setSummary(data.summary ?? []);
    setLoading(false);
  }, [categoryFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalByStatus = (status: string) => summary.filter(s => s.status === status).reduce((sum, s) => sum + Number(s.count), 0);
  const grandTotal = summary.reduce((sum, s) => sum + Number(s.count), 0);

  const filtered = useCases.filter(u =>
    !search || u.title.toLowerCase().includes(search.toLowerCase()) || u.domain.toLowerCase().includes(search.toLowerCase()),
  );

  const grouped = filtered.reduce<Record<string, UseCase[]>>((acc, u) => {
    (acc[u.domain] ??= []).push(u);
    return acc;
  }, {});

  const assessedCount = useCases.filter(u => u.ai_assessed_at).length;
  const notBuiltOrPartial = useCases.filter(u => u.status === 'not_built' || u.status === 'partial').length;

  const groupedEntries = Object.entries(grouped);
  if (sortByAiPriority) {
    groupedEntries.sort(([, a], [, b]) => {
      const rankA = AI_PRIORITY_RANK[a[0].ai_priority ?? ''] ?? 3;
      const rankB = AI_PRIORITY_RANK[b[0].ai_priority ?? ''] ?? 3;
      return rankA - rankB;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Master Use Case Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            {grandTotal} use cases from 2 ChatGPT platform-blueprint conversations, honestly statused against real code.
            See <code className="text-xs bg-gray-100 px-1 rounded">docs/chatgpt-extracts/</code> for full source citations.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {assessedCount} of {notBuiltOrPartial} not-built/partial items have an AI priority assessment (BacklogPrioritizationJob, nightly 02:30 UTC, Ollama-generated — advisory only).
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`rounded-xl border p-3 text-left transition-all ${STATUS_COLOR[s]} ${statusFilter === s ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}>
              <p className="text-2xl font-bold">{totalByStatus(s)}</p>
              <p className="text-xs uppercase font-medium">{s.replace('_', ' ')}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title or domain…" className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]" />
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={sortByAiPriority} onChange={e => setSortByAiPriority(e.target.checked)} />
            Sort domains by AI priority
          </label>
          {(categoryFilter || statusFilter || search) && (
            <button onClick={() => { setCategoryFilter(''); setStatusFilter(''); setSearch(''); }} className="text-xs text-gray-500 hover:underline">Clear filters</button>
          )}
        </div>

        {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
          <div className="space-y-6">
            {groupedEntries.map(([domain, items]) => (
              <div key={domain} className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-gray-700">{domain}</h3>
                    <span className="text-xs text-gray-400">{CATEGORY_LABEL[items[0].category]}</span>
                  </div>
                  {items[0].ai_priority && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${AI_PRIORITY_COLOR[items[0].ai_priority]}`}>
                        AI: {items[0].ai_priority} priority
                      </span>
                      {items[0].ai_buildability && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-gray-300 text-gray-500">
                          {AI_BUILDABILITY_LABEL[items[0].ai_buildability] ?? items[0].ai_buildability}
                        </span>
                      )}
                      {items[0].ai_recommendation && (
                        <span className="text-xs text-gray-500 italic">{items[0].ai_recommendation}</span>
                      )}
                    </div>
                  )}
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {items.map(u => (
                      <tr key={u.id} className="border-t align-top">
                        <td className="px-4 py-2.5 w-24">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[u.status]}`}>{u.status.replace('_', ' ')}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-800">{u.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{u.description}</p>
                          {u.evidence && <p className="text-xs text-gray-400 mt-1 italic">{u.evidence}</p>}
                          {u.module_registry_key && <p className="text-xs text-blue-600 mt-1">→ module_registry: {u.module_registry_key}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 w-20 text-right">{u.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No use cases match this filter.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
