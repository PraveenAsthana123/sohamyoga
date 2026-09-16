'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['Overview', 'Intelligence Feed', 'Add Competitor', 'Add Signal', 'Competitive Matrix'] as const;
type Tab = typeof TABS[number];

interface Competitor {
  id: number;
  name: string;
  website: string | null;
  industry: string | null;
  description: string | null;
  founded_year: number | null;
  employee_count: string | null;
  revenue_range: string | null;
  threat_level: string;
  status: string;
  tags: string[] | null;
  notes: string | null;
  last_analyzed_at: string | null;
  created_at: string;
  unread_signal_count: string; // comes as string from pg COUNT
}

interface Signal {
  id: number;
  competitor_id: number;
  signal_type: string | null;
  title: string;
  description: string | null;
  source_url: string | null;
  detected_at: string;
  impact: string;
  is_read: boolean;
}

const badge = (color: string, label: string) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${color}-500/20 text-${color}-300`}>{label}</span>
);

const threatColor: Record<string, string> = { low: 'green', medium: 'yellow', high: 'orange', critical: 'red' };
const threatEmoji: Record<string, string> = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
const impactColor: Record<string, string> = { low: 'gray', medium: 'yellow', high: 'red' };

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

type SortDir = 'asc' | 'desc';

export default function CompetitorManagementPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [allSignals, setAllSignals] = useState<Signal[]>([]);
  const [signalTypeFilter, setSignalTypeFilter] = useState('');
  const [matrixSort, setMatrixSort] = useState<SortDir>('desc');

  const [compForm, setCompForm] = useState({
    name: '', website: '', industry: '', description: '',
    threat_level: 'medium', employee_count: '', revenue_range: '', tags: '',
  });
  const [sigForm, setSigForm] = useState({
    competitor_id: '', signal_type: '', title: '', description: '', source_url: '', impact: 'low',
  });
  const [savingComp, setSavingComp] = useState(false);
  const [savingSig, setSavingSig] = useState(false);
  const [compMsg, setCompMsg] = useState('');
  const [sigMsg, setSigMsg] = useState('');

  const fetchCompetitors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/competitors', { cache: 'no-store' });
      const data = await res.json() as { competitors: Competitor[] };
      setCompetitors(data.competitors ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchAllSignals = useCallback(async (comps: Competitor[]) => {
    const fetched: Signal[] = [];
    for (const c of comps) {
      try {
        const res = await fetch(`/api/admin/competitors/${c.id}/signals`, { cache: 'no-store' });
        const d = await res.json() as { signals: Signal[] };
        fetched.push(...(d.signals ?? []));
      } catch { /* ignore */ }
    }
    setAllSignals(fetched.sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()));
  }, []);

  useEffect(() => { void fetchCompetitors(); }, [fetchCompetitors]);
  useEffect(() => { if (competitors.length) void fetchAllSignals(competitors); }, [competitors, fetchAllSignals]);

  const fetchSignalsForSelected = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/admin/competitors/${id}/signals`, { cache: 'no-store' });
      const d = await res.json() as { signals: Signal[] };
      setSignals(d.signals ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (selectedId) void fetchSignalsForSelected(selectedId);
  }, [selectedId, fetchSignalsForSelected]);

  async function markRead(sigId: number, competitorId: number) {
    await fetch(`/api/admin/competitors/${competitorId}/signals`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sigId, is_read: true }),
    });
    void fetchCompetitors();
    void fetchAllSignals(competitors);
  }

  async function handleAddComp(e: React.FormEvent) {
    e.preventDefault();
    setSavingComp(true); setCompMsg('');
    try {
      const body = {
        ...compForm,
        tags: compForm.tags ? compForm.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      };
      const res = await fetch('/api/admin/competitors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setCompMsg('Competitor added.');
        setCompForm({ name: '', website: '', industry: '', description: '', threat_level: 'medium', employee_count: '', revenue_range: '', tags: '' });
        void fetchCompetitors();
      } else {
        const d = await res.json() as { error: string };
        setCompMsg(`Error: ${d.error}`);
      }
    } catch { setCompMsg('Network error.'); }
    setSavingComp(false);
  }

  async function handleAddSignal(e: React.FormEvent) {
    e.preventDefault();
    setSavingSig(true); setSigMsg('');
    try {
      const res = await fetch(`/api/admin/competitors/${sigForm.competitor_id}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal_type: sigForm.signal_type || undefined,
          title: sigForm.title,
          description: sigForm.description || undefined,
          source_url: sigForm.source_url || undefined,
          impact: sigForm.impact,
        }),
      });
      if (res.ok) {
        setSigMsg('Signal added.');
        setSigForm({ competitor_id: '', signal_type: '', title: '', description: '', source_url: '', impact: 'low' });
        void fetchCompetitors();
      } else {
        const d = await res.json() as { error: string };
        setSigMsg(`Error: ${d.error}`);
      }
    } catch { setSigMsg('Network error.'); }
    setSavingSig(false);
  }

  const signalTypes = ['pricing_change', 'new_feature', 'funding', 'partnership', 'hire', 'marketing_campaign', 'social_post'];

  const filteredSignals = allSignals.filter(s => !signalTypeFilter || s.signal_type === signalTypeFilter);

  const sortedMatrix = [...competitors].sort((a, b) => {
    const order = ['critical', 'high', 'medium', 'low'];
    const ai = order.indexOf(a.threat_level); const bi = order.indexOf(b.threat_level);
    return matrixSort === 'desc' ? ai - bi : bi - ai;
  });

  const selected = competitors.find(c => c.id === selectedId);

  const glassCard = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
  const inputClass = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400';
  const labelClass = 'block text-white/70 text-sm mb-1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Competitor Intelligence</h1>
          <p className="text-white/60 mt-1">Track, analyze, and respond to competitive threats</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'Overview' && (
          <div className="space-y-4">
            {loading ? <p className="text-white/50">Loading…</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {competitors.map(c => (
                  <button key={c.id} onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                    className={`text-left ${glassCard} transition-all ${selectedId === c.id ? 'ring-2 ring-indigo-400' : 'hover:bg-white/15'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-white font-semibold">{c.name}</h3>
                      <span className="text-lg">{threatEmoji[c.threat_level] ?? '⚪'}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      {badge(threatColor[c.threat_level] ?? 'gray', c.threat_level)}
                      {c.industry && <span className="text-white/50 text-xs">{c.industry}</span>}
                    </div>
                    {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="text-indigo-300 text-xs hover:underline" onClick={e => e.stopPropagation()}>{c.website}</a>}
                    {c.employee_count && <div className="text-white/50 text-xs mt-1">👥 {c.employee_count} employees</div>}
                    {Number(c.unread_signal_count) > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1 bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full text-xs">
                        🔔 {c.unread_signal_count} unread
                      </div>
                    )}
                  </button>
                ))}
                {competitors.length === 0 && <p className="text-white/40 col-span-3">No competitors tracked yet.</p>}
              </div>
            )}
            {selected && (
              <div className={glassCard}>
                <h2 className="text-white font-semibold text-lg mb-3">Signals — {selected.name}</h2>
                {signals.length === 0 ? <p className="text-white/40">No signals recorded.</p> : (
                  <div className="space-y-3">
                    {signals.map(s => (
                      <div key={s.id} className={`flex items-start gap-3 border-b border-white/5 pb-3 ${!s.is_read ? 'font-semibold' : ''}`}>
                        <div>
                          <div className="text-white text-sm">{s.title}</div>
                          {s.description && <div className="text-white/60 text-xs mt-0.5">{s.description}</div>}
                          <div className="flex items-center gap-2 mt-1">
                            {s.signal_type && badge('blue', s.signal_type.replace('_', ' '))}
                            {badge(impactColor[s.impact] ?? 'gray', s.impact + ' impact')}
                            <span className="text-white/40 text-xs">{formatDate(s.detected_at)}</span>
                          </div>
                        </div>
                        {!s.is_read && (
                          <button onClick={() => void markRead(s.id, selected.id)}
                            className="ml-auto bg-white/10 hover:bg-white/20 text-white/60 px-2 py-1 rounded text-xs flex-shrink-0">
                            Mark read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Intelligence Feed */}
        {tab === 'Intelligence Feed' && (
          <div className={glassCard}>
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => setSignalTypeFilter('')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!signalTypeFilter ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                All
              </button>
              {signalTypes.map(t => (
                <button key={t} onClick={() => setSignalTypeFilter(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${signalTypeFilter === t ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            {filteredSignals.length === 0 ? <p className="text-white/40">No signals found.</p> : (
              <div className="space-y-3">
                {filteredSignals.map(s => {
                  const comp = competitors.find(c => c.id === s.competitor_id);
                  return (
                    <div key={s.id} className={`flex items-start gap-4 border-b border-white/5 pb-3 ${!s.is_read ? 'text-white' : 'text-white/70'}`}>
                      <div className="flex-1">
                        <div className={`text-sm ${!s.is_read ? 'font-semibold' : ''}`}>{s.title}</div>
                        <div className="text-white/50 text-xs mt-0.5">{comp?.name ?? `#${s.competitor_id}`}</div>
                        {s.description && <div className="text-white/60 text-xs mt-1">{s.description}</div>}
                        <div className="flex items-center gap-2 mt-1">
                          {s.signal_type && badge('blue', s.signal_type.replace(/_/g, ' '))}
                          {badge(impactColor[s.impact] ?? 'gray', s.impact)}
                        </div>
                      </div>
                      <div className="text-white/40 text-xs flex-shrink-0">{formatDate(s.detected_at)}</div>
                      {!s.is_read && (
                        <button onClick={() => void markRead(s.id, s.competitor_id)}
                          className="bg-white/10 hover:bg-white/20 text-white/60 px-2 py-1 rounded text-xs flex-shrink-0">
                          Read
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Add Competitor */}
        {tab === 'Add Competitor' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold text-lg mb-4">Add Competitor</h2>
            <form onSubmit={e => void handleAddComp(e)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Name *</label>
                <input className={inputClass} value={compForm.name} onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))} placeholder="Competitor Inc." required />
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <input className={inputClass} value={compForm.website} onChange={e => setCompForm(f => ({ ...f, website: e.target.value }))} placeholder="https://competitor.com" />
              </div>
              <div>
                <label className={labelClass}>Industry</label>
                <input className={inputClass} value={compForm.industry} onChange={e => setCompForm(f => ({ ...f, industry: e.target.value }))} placeholder="Wellness / Yoga / Fitness" />
              </div>
              <div>
                <label className={labelClass}>Threat Level</label>
                <select className={inputClass} value={compForm.threat_level} onChange={e => setCompForm(f => ({ ...f, threat_level: e.target.value }))}>
                  {['low', 'medium', 'high', 'critical'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Employee Count</label>
                <select className={inputClass} value={compForm.employee_count} onChange={e => setCompForm(f => ({ ...f, employee_count: e.target.value }))}>
                  <option value="">— Select —</option>
                  {['1-10', '11-50', '51-200', '201-1000', '1000+'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Revenue Range</label>
                <select className={inputClass} value={compForm.revenue_range} onChange={e => setCompForm(f => ({ ...f, revenue_range: e.target.value }))}>
                  <option value="">— Select —</option>
                  {['<1M', '1M-10M', '10M-100M', '100M+'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea rows={2} className={inputClass} value={compForm.description} onChange={e => setCompForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of their offering…" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Tags (comma-separated)</label>
                <input className={inputClass} value={compForm.tags} onChange={e => setCompForm(f => ({ ...f, tags: e.target.value }))} placeholder="yoga, canada, digital" />
              </div>
              <div className="md:col-span-2 flex items-center gap-4">
                <button type="submit" disabled={savingComp} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
                  {savingComp ? 'Adding…' : 'Add Competitor'}
                </button>
                {compMsg && <span className={`text-sm ${compMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{compMsg}</span>}
              </div>
            </form>
          </div>
        )}

        {/* Add Signal */}
        {tab === 'Add Signal' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold text-lg mb-4">Add Intelligence Signal</h2>
            <form onSubmit={e => void handleAddSignal(e)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Competitor *</label>
                <select className={inputClass} value={sigForm.competitor_id} onChange={e => setSigForm(f => ({ ...f, competitor_id: e.target.value }))} required>
                  <option value="">— Select competitor —</option>
                  {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Signal Type</label>
                <select className={inputClass} value={sigForm.signal_type} onChange={e => setSigForm(f => ({ ...f, signal_type: e.target.value }))}>
                  <option value="">— Select type —</option>
                  {signalTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Title *</label>
                <input className={inputClass} value={sigForm.title} onChange={e => setSigForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Launched new pricing tier" required />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea rows={2} className={inputClass} value={sigForm.description} onChange={e => setSigForm(f => ({ ...f, description: e.target.value }))} placeholder="Details about this signal…" />
              </div>
              <div>
                <label className={labelClass}>Source URL</label>
                <input className={inputClass} value={sigForm.source_url} onChange={e => setSigForm(f => ({ ...f, source_url: e.target.value }))} placeholder="https://…" />
              </div>
              <div>
                <label className={labelClass}>Impact</label>
                <select className={inputClass} value={sigForm.impact} onChange={e => setSigForm(f => ({ ...f, impact: e.target.value }))}>
                  {['low', 'medium', 'high'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 flex items-center gap-4">
                <button type="submit" disabled={savingSig} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
                  {savingSig ? 'Adding…' : 'Add Signal'}
                </button>
                {sigMsg && <span className={`text-sm ${sigMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{sigMsg}</span>}
              </div>
            </form>
          </div>
        )}

        {/* Competitive Matrix */}
        {tab === 'Competitive Matrix' && (
          <div className={glassCard}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">Competitive Matrix</h2>
              <button
                onClick={() => setMatrixSort(s => s === 'desc' ? 'asc' : 'desc')}
                className="bg-white/10 hover:bg-white/20 text-white/70 px-3 py-1 rounded text-xs">
                Sort threat: {matrixSort === 'desc' ? 'High→Low ↓' : 'Low→High ↑'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white/80">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 text-xs uppercase">
                    <th className="text-left py-2 pr-4">Name</th>
                    <th className="text-left py-2 pr-4">Threat</th>
                    <th className="text-left py-2 pr-4">Industry</th>
                    <th className="text-left py-2 pr-4">Employees</th>
                    <th className="text-left py-2 pr-4">Revenue</th>
                    <th className="text-left py-2 pr-4">Signals (all)</th>
                    <th className="text-left py-2">Last Analyzed</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMatrix.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-white/40">No competitors yet.</td></tr>}
                  {sortedMatrix.map(c => {
                    const sigCount = allSignals.filter(s => s.competitor_id === c.id).length;
                    return (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 pr-4 font-medium text-white">{c.name}</td>
                        <td className="py-2 pr-4">{threatEmoji[c.threat_level]} {badge(threatColor[c.threat_level] ?? 'gray', c.threat_level)}</td>
                        <td className="py-2 pr-4 text-white/60">{c.industry ?? '—'}</td>
                        <td className="py-2 pr-4 text-white/60">{c.employee_count ?? '—'}</td>
                        <td className="py-2 pr-4 text-white/60">{c.revenue_range ?? '—'}</td>
                        <td className="py-2 pr-4">{sigCount}</td>
                        <td className="py-2 text-white/60 text-xs">{formatDate(c.last_analyzed_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
