'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = "Porter's Five Forces" | 'Technology Radar' | 'Data Collection' | 'Web Scraping' | 'Intelligence Dashboard';
const TABS: Tab[] = ["Porter's Five Forces", 'Technology Radar', 'Data Collection', 'Web Scraping', 'Intelligence Dashboard'];

interface PorterAnalysis { id: number; industry: string; company_name: string; competitive_rivalry: number; supplier_power: number; buyer_power: number; threat_new_entry: number; threat_substitutes: number; overall_score: number; summary: string; recommendations: string[]; created_at: string; }
interface TechScout { id: number; technology_name: string; category: string; maturity_level: string; vendor: string; use_case: string; relevance_score: number; adoption_timeline: string; status: string; }
interface DataJob { id: number; name: string; source_type: string; source_url: string; schedule: string; last_run: string; records_collected: number; status: string; }
interface ScrapingConfig { id: number; name: string; target_url: string; frequency: string; data_points: number; purpose: string; status: string; }

const MATURITY_COLOR: Record<string, string> = { emerging: 'bg-red-100 text-red-700', 'early adopters': 'bg-orange-100 text-orange-700', growing: 'bg-yellow-100 text-yellow-700', mature: 'bg-green-100 text-green-700' };
function ForceBar({ label, score }: { label: string; score: number }) {
  const colors = ['', 'bg-green-500', 'bg-green-400', 'bg-yellow-400', 'bg-orange-400', 'bg-red-500'];
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-40 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-3">
        <div className={`h-3 rounded-full ${colors[score] || 'bg-gray-400'}`} style={{ width: `${score * 20}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-6">{score}/5</span>
    </div>
  );
}

export default function MarketIntelligencePage() {
  const [tab, setTab] = useState<Tab>("Porter's Five Forces");
  const [analyses, setAnalyses] = useState<PorterAnalysis[]>([]);
  const [techScouts, setTechScouts] = useState<TechScout[]>([]);
  const [dataJobs, setDataJobs] = useState<DataJob[]>([]);
  const [scrapingConfigs, setScrapingConfigs] = useState<ScrapingConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<PorterAnalysis | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, unknown> | null>(null);
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null);
  const [scanForm, setScanForm] = useState({ domain: 'wellness & fitness apps', focus_area: 'AI and personalization' });

  const loadData = useCallback(async () => {
    const [aRes, tRes, dRes, sRes] = await Promise.all([
      fetch('/api/admin/market-intelligence'),
      fetch('/api/admin/market-intelligence/technology'),
      fetch('/api/admin/market-intelligence/data-collection'),
      fetch('/api/admin/market-intelligence/scraping'),
    ]);
    if (aRes.ok) { const d = await aRes.json() as PorterAnalysis[]; setAnalyses(d); if (d.length && !selectedAnalysis) setSelectedAnalysis(d[0]); }
    if (tRes.ok) setTechScouts(await tRes.json() as TechScout[]);
    if (dRes.ok) setDataJobs(await dRes.json() as DataJob[]);
    if (sRes.ok) setScrapingConfigs(await sRes.json() as ScrapingConfig[]);
  }, [selectedAnalysis]);

  useEffect(() => { loadData(); }, [loadData]);

  const runAIAnalysis = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/market-intelligence/${id}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await res.json() as { updated: PorterAnalysis; ai_analysis: Record<string, unknown> };
      setAiAnalysis(d.ai_analysis);
      setSelectedAnalysis(d.updated);
      await loadData();
    } finally { setLoading(false); }
  };

  const runDataJob = async (id: number) => {
    setLoading(true);
    try {
      await fetch(`/api/admin/market-intelligence/data-collection/${id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      await loadData();
    } finally { setLoading(false); }
  };

  const runTechScan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/market-intelligence/technology/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scanForm) });
      setScanResult(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Market Intelligence</h1>
        <p className="text-slate-300 text-sm">Porter&apos;s Five Forces analysis, technology radar, data collection & web scraping</p>
      </div>

      <div className="bg-white border-b px-6 py-3 flex gap-8">
        <div><span className="text-2xl font-bold text-slate-800">{analyses.length}</span><span className="text-gray-500 text-sm ml-1">Analyses</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{techScouts.length}</span><span className="text-gray-500 text-sm ml-1">Tech Monitored</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{dataJobs.reduce((s, j) => s + j.records_collected, 0).toLocaleString()}</span><span className="text-gray-500 text-sm ml-1">Records Collected</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{scrapingConfigs.filter(c => c.status === 'active').length}</span><span className="text-gray-500 text-sm ml-1">Active Scrapers</span></div>
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
        {/* Porter's Five Forces */}
        {tab === "Porter's Five Forces" && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 space-y-3">
              {analyses.map(a => (
                <button key={a.id} onClick={() => setSelectedAnalysis(a)}
                  className={`w-full text-left border rounded p-4 hover:bg-blue-50 transition-colors ${selectedAnalysis?.id === a.id ? 'border-blue-500 bg-blue-50' : 'bg-white'}`}>
                  <p className="font-medium text-sm">{a.company_name}</p>
                  <p className="text-xs text-gray-500">{a.industry}</p>
                  <p className="text-sm font-bold text-blue-700 mt-1">Score: {Number(a.overall_score).toFixed(1)}/5</p>
                </button>
              ))}
            </div>
            {selectedAnalysis && (
              <div className="col-span-2 bg-white rounded-lg border p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="font-bold text-lg text-slate-800">{selectedAnalysis.company_name}</h2>
                    <p className="text-sm text-gray-500">{selectedAnalysis.industry}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-3xl font-bold text-blue-700">{Number(selectedAnalysis.overall_score).toFixed(1)}</span>
                    <button onClick={() => runAIAnalysis(selectedAnalysis.id)} disabled={loading}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                      {loading ? 'Analyzing...' : '🤖 AI Analyze'}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 mb-4">
                  <ForceBar label="Competitive Rivalry" score={selectedAnalysis.competitive_rivalry} />
                  <ForceBar label="Supplier Power" score={selectedAnalysis.supplier_power} />
                  <ForceBar label="Buyer Power" score={selectedAnalysis.buyer_power} />
                  <ForceBar label="Threat of New Entry" score={selectedAnalysis.threat_new_entry} />
                  <ForceBar label="Threat of Substitutes" score={selectedAnalysis.threat_substitutes} />
                </div>
                {selectedAnalysis.summary && <div className="bg-blue-50 rounded p-3 mb-3"><p className="text-xs font-bold text-blue-800 mb-1">Summary</p><p className="text-sm text-gray-700">{selectedAnalysis.summary}</p></div>}
                {selectedAnalysis.recommendations?.length > 0 && (
                  <div><p className="text-xs font-bold text-gray-700 mb-2">Strategic Recommendations</p>
                    {selectedAnalysis.recommendations.map((r, i) => <p key={i} className="text-xs text-gray-600 mb-1">• {r}</p>)}</div>
                )}
                {aiAnalysis && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold text-gray-700">AI Force-by-Force Rationale</p>
                    {Object.entries(aiAnalysis).map(([force, detail]) => (
                      <div key={force} className="bg-gray-50 rounded p-2">
                        <p className="text-xs font-medium capitalize">{force.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-600">{String((detail as Record<string, unknown>)?.rationale || '')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Technology Radar */}
        {tab === 'Technology Radar' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">AI Technology Scanner</h2>
              <div className="space-y-3">
                <div><label className="text-xs font-medium text-gray-600">Domain</label>
                  <input value={scanForm.domain} onChange={e => setScanForm(p => ({ ...p, domain: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600">Focus Area</label>
                  <input value={scanForm.focus_area} onChange={e => setScanForm(p => ({ ...p, focus_area: e.target.value }))} className="w-full mt-1 border rounded px-3 py-2 text-sm" /></div>
                <button onClick={runTechScan} disabled={loading}
                  className="w-full bg-purple-600 text-white py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                  {loading ? 'Scanning...' : '🔭 AI Tech Scan'}
                </button>
              </div>
              {scanResult && (
                <div className="mt-4 bg-purple-50 rounded p-3">
                  <p className="text-xs font-bold text-purple-800">Trend Summary</p>
                  <p className="text-xs text-gray-700 mt-1">{String(scanResult.trend_summary)}</p>
                </div>
              )}
            </div>
            <div className="col-span-2 space-y-3">
              {/* Maturity ring legend */}
              <div className="bg-white rounded-lg border p-4">
                <p className="text-xs font-bold text-gray-700 mb-2">Technology Maturity Rings</p>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(MATURITY_COLOR).map(([k, v]) => <span key={k} className={`text-xs px-2 py-1 rounded ${v}`}>{k}</span>)}
                </div>
              </div>
              {[...(['emerging', 'early adopters', 'growing', 'mature'] as const)].map(m => {
                const items = techScouts.filter(t => t.maturity_level === m);
                if (!items.length) return null;
                return (
                  <div key={m} className="bg-white rounded-lg border p-4">
                    <h3 className={`text-xs font-bold px-2 py-0.5 rounded inline-block mb-3 ${MATURITY_COLOR[m]}`}>{m.toUpperCase()}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map(t => (
                        <div key={t.id} className="border rounded p-3">
                          <p className="font-medium text-xs">{t.technology_name}</p>
                          <p className="text-xs text-gray-500">{t.category} · {t.adoption_timeline}</p>
                          <p className="text-xs text-gray-600 mt-1">{t.use_case}</p>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-blue-600">Relevance: {t.relevance_score}/5</span>
                            <span className="text-xs text-gray-400">{t.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {scanResult && (scanResult.technologies as Record<string, unknown>[])?.length > 0 && (
                <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
                  <h3 className="font-medium text-sm text-purple-800 mb-3">AI Discovered Technologies</h3>
                  {(scanResult.technologies as Record<string, unknown>[]).map((t, i) => (
                    <div key={i} className="border rounded p-3 bg-white mb-2">
                      <p className="font-medium text-xs">{String(t.name)} <span className="text-gray-400">({String(t.category)})</span></p>
                      <p className="text-xs text-gray-600">{String(t.use_case)}</p>
                      <p className="text-xs text-green-700 mt-1 italic">{String(t.opportunity)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Collection */}
        {tab === 'Data Collection' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800">Data Collection Jobs</h2>
            <div className="grid grid-cols-3 gap-4">
              {dataJobs.map(j => (
                <div key={j.id} className="bg-white rounded-lg border p-5">
                  <div className="flex justify-between items-start mb-3">
                    <p className="font-medium text-sm">{j.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${j.status === 'idle' ? 'bg-gray-100' : 'bg-blue-100 text-blue-700'}`}>{j.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{j.source_type} · {j.schedule}</p>
                  <p className="text-xs text-gray-500 truncate mb-3">{j.source_url}</p>
                  <div className="flex justify-between items-center">
                    <div><p className="text-xl font-bold text-slate-800">{j.records_collected.toLocaleString()}</p><p className="text-xs text-gray-400">records</p></div>
                    <button onClick={() => runDataJob(j.id)} disabled={loading}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                      {loading ? '...' : '▶ Run'}
                    </button>
                  </div>
                  {j.last_run && <p className="text-xs text-gray-400 mt-2">Last run: {new Date(j.last_run).toLocaleString()}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Web Scraping */}
        {tab === 'Web Scraping' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800">Web Scraping Configurations</h2>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Name','Target URL','Frequency','Data Points','Purpose','Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody>{scrapingConfigs.map(c => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[200px]">{c.target_url}</td>
                    <td className="px-4 py-3">{c.frequency}</td>
                    <td className="px-4 py-3 font-bold text-blue-700">{c.data_points.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{c.purpose}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{c.status}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* Intelligence Dashboard */}
        {tab === 'Intelligence Dashboard' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              <h2 className="font-semibold text-slate-800">Recent Analyses</h2>
              {analyses.map(a => (
                <div key={a.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium">{a.company_name} <span className="text-gray-400 text-sm">— {a.industry}</span></p>
                    <span className="text-2xl font-bold text-blue-700">{Number(a.overall_score).toFixed(1)}/5</span>
                  </div>
                  <p className="text-xs text-gray-600">{a.summary}</p>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-sm text-slate-700 mb-3">Tech Watchlist</h3>
                {techScouts.filter(t => t.status === 'evaluating').map(t => (
                  <div key={t.id} className="border-b pb-2 mb-2 last:border-0">
                    <p className="text-xs font-medium">{t.technology_name}</p>
                    <p className="text-xs text-gray-500">{t.adoption_timeline}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${MATURITY_COLOR[t.maturity_level]}`}>{t.maturity_level}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-sm text-slate-700 mb-3">Data Freshness</h3>
                {dataJobs.map(j => (
                  <div key={j.id} className="flex justify-between items-center border-b pb-2 mb-2 last:border-0">
                    <p className="text-xs text-gray-700">{j.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${j.last_run ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{j.last_run ? 'Fresh' : 'Never run'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

