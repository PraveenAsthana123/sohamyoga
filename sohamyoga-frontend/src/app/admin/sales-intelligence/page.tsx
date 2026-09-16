'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'Pipeline' | 'Deal Coach' | 'Knowledge Base' | 'AI Assistant' | 'Forecast';
const TABS: Tab[] = ['Pipeline', 'Deal Coach', 'Knowledge Base', 'AI Assistant', 'Forecast'];

interface Deal { id: number; company: string; contact: string; value: number; stage: string; probability: number; next_action: string; next_action_date: string; ai_notes: string; }
interface KBArticle { id: number; title: string; category: string; content: string; tags: string[]; usage_count: number; }
interface AIQuery { id: number; question: string; answer: string; helpful: boolean | null; created_at: string; }

const STAGE_COLOR: Record<string, string> = { prospecting: 'bg-gray-100 text-gray-700', qualifying: 'bg-blue-100 text-blue-700', proposal: 'bg-yellow-100 text-yellow-700', negotiation: 'bg-orange-100 text-orange-700', 'closed won': 'bg-green-100 text-green-700', 'closed lost': 'bg-red-100 text-red-700' };
const STAGES = ['prospecting', 'qualifying', 'proposal', 'negotiation', 'closed won', 'closed lost'];

export default function SalesIntelligencePage() {
  const [tab, setTab] = useState<Tab>('Pipeline');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [queries, setQueries] = useState<AIQuery[]>([]);
  const [stats, setStats] = useState<{ pipeline_total: string; weighted_forecast: string; avg_deal_size: string; won_count: string }>({ pipeline_total: '0', weighted_forecast: '0', avg_deal_size: '0', won_count: '0' });
  const [loading, setLoading] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [coaching, setCoaching] = useState<Record<string, unknown> | null>(null);
  const [kbSearch, setKbSearch] = useState('');
  const [question, setQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<Record<string, unknown> | null>(null);
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null);

  const loadData = useCallback(async () => {
    const [dRes, kRes] = await Promise.all([
      fetch('/api/admin/sales-intelligence'),
      fetch('/api/admin/sales-intelligence/knowledge'),
    ]);
    if (dRes.ok) { const d = await dRes.json() as { deals: Deal[]; stats: typeof stats }; setDeals(d.deals || []); setStats(d.stats); }
    if (kRes.ok) setArticles(await kRes.json() as KBArticle[]);
  }, []);

  const loadForecast = useCallback(async () => {
    const res = await fetch('/api/admin/sales-intelligence/forecast');
    if (res.ok) setForecast(await res.json() as Record<string, unknown>);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (tab === 'Forecast') loadForecast(); }, [tab, loadForecast]);

  const getCoaching = async (deal: Deal) => {
    setSelectedDeal(deal); setLoading(true); setCoaching(null);
    try {
      const res = await fetch(`/api/admin/sales-intelligence/${deal.id}/coach`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      setCoaching(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  const searchKB = async () => {
    const res = await fetch(`/api/admin/sales-intelligence/knowledge?q=${encodeURIComponent(kbSearch)}`);
    if (res.ok) setArticles(await res.json() as KBArticle[]);
  };

  const askAI = async () => {
    if (!question) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sales-intelligence/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
      const d = await res.json() as Record<string, unknown>;
      setAiAnswer(d);
      setQueries(prev => [{ id: Date.now(), question, answer: String(d.answer), helpful: null, created_at: new Date().toISOString() }, ...prev.slice(0, 9)]);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Sales Intelligence</h1>
        <p className="text-slate-300 text-sm">Lead-to-cash pipeline, AI deal coaching, RAG knowledge base & sales forecasting</p>
      </div>

      <div className="bg-white border-b px-6 py-3 flex gap-8">
        <div><span className="text-2xl font-bold text-slate-800">${Number(stats.pipeline_total).toLocaleString()}</span><span className="text-gray-500 text-sm ml-1">Pipeline</span></div>
        <div><span className="text-2xl font-bold text-blue-700">${Number(stats.weighted_forecast).toLocaleString()}</span><span className="text-gray-500 text-sm ml-1">Weighted Forecast</span></div>
        <div><span className="text-2xl font-bold text-slate-800">${Number(stats.avg_deal_size).toLocaleString()}</span><span className="text-gray-500 text-sm ml-1">Avg Deal Size</span></div>
        <div><span className="text-2xl font-bold text-green-700">{stats.won_count}</span><span className="text-gray-500 text-sm ml-1">Deals Won</span></div>
      </div>

      <div className="bg-white border-b px-6 flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* Pipeline Kanban */}
        {tab === 'Pipeline' && (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map(stage => {
              const stageDeals = deals.filter(d => d.stage === stage);
              const stageValue = stageDeals.reduce((s, d) => s + Number(d.value), 0);
              return (
                <div key={stage} className="min-w-[220px] flex-shrink-0">
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-xs px-2 py-0.5 rounded capitalize ${STAGE_COLOR[stage]}`}>{stage}</span>
                    <span className="text-xs text-gray-400">${stageValue.toLocaleString()}</span>
                  </div>
                  <div className="space-y-2">
                    {stageDeals.map(d => (
                      <div key={d.id} className="bg-white border rounded p-3 cursor-pointer hover:shadow-sm transition-shadow" onClick={() => { setSelectedDeal(d); setTab('Deal Coach'); }}>
                        <p className="font-medium text-sm">{d.company}</p>
                        <p className="text-xs text-gray-500">{d.contact}</p>
                        <div className="flex justify-between mt-2">
                          <span className="text-sm font-bold text-slate-800">${Number(d.value).toLocaleString()}</span>
                          <span className="text-xs text-blue-700">{d.probability}%</span>
                        </div>
                        {d.next_action && <p className="text-xs text-gray-500 mt-1 line-clamp-1">→ {d.next_action}</p>}
                      </div>
                    ))}
                    {stageDeals.length === 0 && <div className="border-2 border-dashed rounded p-4 text-center text-xs text-gray-300">No deals</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Deal Coach */}
        {tab === 'Deal Coach' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 space-y-2">
              <h2 className="font-semibold text-slate-800 mb-3">Select a Deal</h2>
              {deals.filter(d => !['closed won','closed lost'].includes(d.stage)).map(d => (
                <button key={d.id} onClick={() => getCoaching(d)}
                  className={`w-full text-left border rounded p-3 hover:bg-blue-50 transition-colors ${selectedDeal?.id === d.id ? 'border-blue-500 bg-blue-50' : 'bg-white'}`}>
                  <p className="font-medium text-sm">{d.company}</p>
                  <p className="text-xs text-gray-500">{d.contact}</p>
                  <div className="flex justify-between mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${STAGE_COLOR[d.stage]}`}>{d.stage}</span>
                    <span className="text-xs font-bold">${Number(d.value).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="col-span-2 bg-white rounded-lg border p-5">
              {!selectedDeal && <p className="text-gray-400 text-center mt-16">Select a deal to get AI coaching</p>}
              {selectedDeal && !coaching && loading && <p className="text-center text-gray-500 mt-16">AI Coach is analyzing your deal...</p>}
              {coaching && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="font-bold text-lg text-slate-800">{selectedDeal?.company}</h2>
                    <span className="text-sm text-blue-700 font-bold">AI Probability: {String(coaching.probability_assessment)}%</span>
                  </div>
                  <div className="bg-blue-50 rounded p-4"><p className="text-xs font-bold text-blue-800 mb-1">Next Best Action</p><p className="text-sm">{String(coaching.next_best_action)}</p></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-red-50 rounded p-3"><p className="text-xs font-bold text-red-800 mb-1">Risk Factors</p>{(coaching.risk_factors as string[]).map((r, i) => <p key={i} className="text-xs">• {r}</p>)}</div>
                    <div className="bg-green-50 rounded p-3"><p className="text-xs font-bold text-green-800 mb-1">Closing Strategy</p><p className="text-xs">{String(coaching.closing_strategy)}</p></div>
                  </div>
                  <div className="bg-orange-50 rounded p-3">
                    <p className="text-xs font-bold text-orange-800 mb-1">Objection Handling</p>
                    <p className="text-xs font-medium text-gray-700">Likely objection: {String((coaching.objection_handling as Record<string,unknown>)?.likely_objection)}</p>
                    <p className="text-xs text-gray-600 mt-1">Response: {String((coaching.objection_handling as Record<string,unknown>)?.response_script)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs font-bold text-gray-700 mb-1">Email Template</p>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">{String(coaching.email_template)}</pre>
                    <button onClick={() => navigator.clipboard.writeText(String(coaching.email_template))} className="text-xs text-blue-600 hover:underline mt-2">Copy Email</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Knowledge Base */}
        {tab === 'Knowledge Base' && (
          <div>
            <div className="flex gap-3 mb-4">
              <input value={kbSearch} onChange={e => setKbSearch(e.target.value)}
                placeholder="Search articles by title, content, or tag..."
                className="flex-1 border rounded px-3 py-2 text-sm" />
              <button onClick={searchKB} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Search</button>
              <button onClick={() => { setKbSearch(''); loadData(); }} className="bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-200">Clear</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {articles.map(a => (
                <div key={a.id} className="bg-white border rounded p-5">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{a.category}</span>
                    <span className="text-xs text-gray-400">Used {a.usage_count}x</span>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-800 mb-2">{a.title}</h3>
                  <p className="text-xs text-gray-600 line-clamp-3">{a.content}</p>
                  <div className="flex flex-wrap gap-1 mt-3">{a.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t}</span>)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Assistant */}
        {tab === 'AI Assistant' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              <div className="bg-white rounded-lg border p-5">
                <h2 className="font-semibold text-slate-800 mb-4">Ask the AI Sales Copilot</h2>
                <div className="flex gap-3">
                  <input value={question} onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && askAI()}
                    placeholder="Ask anything: pricing, objections, competitor comparisons..."
                    className="flex-1 border rounded px-3 py-2 text-sm" />
                  <button onClick={askAI} disabled={loading || !question}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                    {loading ? '...' : 'Ask'}
                  </button>
                </div>
              </div>
              {aiAnswer && (
                <div className="bg-white rounded-lg border p-5">
                  <div className="flex gap-2 mb-3">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">AI Response</span>
                    {!!aiAnswer.ai_generated && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Ollama</span>}
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">{String(aiAnswer.answer)}</p>
                  {(aiAnswer.sources as { title: string; category: string }[])?.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium text-gray-500 mb-1">Sources used:</p>
                      <div className="flex flex-wrap gap-2">{(aiAnswer.sources as { title: string; category: string }[]).map((s, i) => <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s.title}</span>)}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-white rounded-lg border p-5">
                <h3 className="font-medium text-slate-700 mb-3">Recent Queries</h3>
                <div className="space-y-3">
                  {queries.map(q => (
                    <div key={q.id} className="border-b pb-3 last:border-0">
                      <p className="text-xs font-medium text-gray-700">Q: {q.question}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">A: {q.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-sm text-slate-700 mb-3">Quick Questions</h3>
                {[
                  'How do I handle the price objection?',
                  'What are our strongest differentiators?',
                  'How long is our typical sales cycle?',
                  'Best approach for a cold outreach?',
                ].map(q => (
                  <button key={q} onClick={() => { setQuestion(q); }}
                    className="w-full text-left text-xs text-blue-600 hover:underline py-1 border-b last:border-0">{q}</button>
                ))}
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-sm text-slate-700 mb-3">Top KB Articles</h3>
                {articles.slice(0, 4).map(a => (
                  <div key={a.id} className="border-b pb-2 mb-2 last:border-0">
                    <p className="text-xs font-medium">{a.title}</p>
                    <p className="text-xs text-gray-400">{a.usage_count} uses</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Forecast */}
        {tab === 'Forecast' && (
          <div className="space-y-6">
            {forecast && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg border p-6 text-center"><p className="text-xs text-gray-500">Total Pipeline</p><p className="text-3xl font-bold text-slate-800">${Number(forecast.pipeline_total).toLocaleString()}</p></div>
                  <div className="bg-white rounded-lg border p-6 text-center"><p className="text-xs text-gray-500">Weighted Forecast</p><p className="text-3xl font-bold text-blue-700">${Number(forecast.weighted_forecast).toLocaleString()}</p></div>
                  <div className="bg-white rounded-lg border p-6 text-center"><p className="text-xs text-gray-500">Active Deals</p><p className="text-3xl font-bold text-slate-800">{String(forecast.deal_count)}</p></div>
                </div>
                <div className="bg-white rounded-lg border p-5">
                  <p className="text-xs font-bold text-purple-800 mb-2">AI Pipeline Commentary</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{String(forecast.ai_commentary)}</p>
                </div>
                <div className="bg-white rounded-lg border p-5">
                  <h3 className="font-semibold text-slate-800 mb-4">Pipeline by Stage</h3>
                  {Object.entries(forecast.by_stage as Record<string, { count: number; value: number; weighted: number }>).map(([stage, data]) => (
                    <div key={stage} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <span className={`text-xs px-2 py-0.5 rounded w-28 text-center capitalize ${STAGE_COLOR[stage] || 'bg-gray-100'}`}>{stage}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div className="bg-blue-500 h-4 rounded-full" style={{ width: `${Math.min((data.value / (Number(forecast.pipeline_total) || 1)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-sm font-bold w-24 text-right">${data.value.toLocaleString()}</span>
                      <span className="text-xs text-gray-400 w-20 text-right">W: ${Math.round(data.weighted).toLocaleString()}</span>
                      <span className="text-xs text-gray-400 w-12 text-right">{data.count} deal{data.count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!forecast && <div className="bg-white rounded-lg border p-8 text-center text-gray-400">Loading forecast...</div>}
          </div>
        )}
      </div>
    </div>
  );
}
