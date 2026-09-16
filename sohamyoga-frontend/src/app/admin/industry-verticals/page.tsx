'use client';
import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Vertical = {
  slug: string;
  name: string;
  description: string;
  campaigns_count: number;
  hooks_count: number;
};

type PlaybookData = {
  slug: string;
  name: string;
  playbook: { summary: string; phases: { name: string; actions: string[] }[] } | null;
  hooks: string[];
  campaigns: { id: string; name: string; status: string }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const VERTICALS_META: { slug: string; name: string; icon: string; color: string }[] = [
  { slug: 'dental', name: 'Dental', icon: '🦷', color: 'bg-blue-100 border-blue-300' },
  { slug: 'school', name: 'School', icon: '🏫', color: 'bg-green-100 border-green-300' },
  { slug: 'real-estate', name: 'Real Estate', icon: '🏡', color: 'bg-yellow-100 border-yellow-300' },
  { slug: 'qsr', name: 'QSR', icon: '🍔', color: 'bg-orange-100 border-orange-300' },
  { slug: 'beauty', name: 'Beauty', icon: '💄', color: 'bg-pink-100 border-pink-300' },
  { slug: 'online-teaching', name: 'Online Teaching', icon: '📚', color: 'bg-purple-100 border-purple-300' },
  { slug: 'astrology', name: 'Astrology', icon: '⭐', color: 'bg-indigo-100 border-indigo-300' },
  { slug: 'saas', name: 'SaaS', icon: '☁️', color: 'bg-cyan-100 border-cyan-300' },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function IndustryVerticalsPage() {
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playbooks, setPlaybooks] = useState<Record<string, PlaybookData>>({});
  const [playbookLoading, setPlaybookLoading] = useState<string | null>(null);
  const [ollamaSlug, setOllamaSlug] = useState('');
  const [ollamaPrompt, setOllamaPrompt] = useState('');
  const [ollamaResult, setOllamaResult] = useState('');
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/industry-verticals')
      .then(r => r.json())
      .then(d => { setVerticals(d.verticals ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load verticals'); setLoading(false); });
  }, []);

  function toggleExpand(slug: string) {
    if (expanded === slug) { setExpanded(null); return; }
    setExpanded(slug);
    if (!playbooks[slug]) {
      setPlaybookLoading(slug);
      fetch(`/api/admin/industry-verticals/${slug}`)
        .then(r => r.json())
        .then(d => { setPlaybooks(prev => ({ ...prev, [slug]: d })); setPlaybookLoading(null); })
        .catch(() => setPlaybookLoading(null));
    }
  }

  async function generateHooks() {
    if (!ollamaSlug || !ollamaPrompt) return;
    setOllamaLoading(true);
    setOllamaResult('');
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate 10 compelling marketing hooks for the ${ollamaSlug} vertical. Context: ${ollamaPrompt}. Return as a numbered list.`,
        }),
      });
      const d = await r.json();
      setOllamaResult(d.result ?? d.text ?? JSON.stringify(d));
    } catch {
      setOllamaResult('Error connecting to AI service.');
    } finally {
      setOllamaLoading(false);
    }
  }

  const verticalMap = Object.fromEntries(verticals.map(v => [v.slug, v]));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Industry Verticals</h1>
          <p className="text-gray-500 mt-1">Playbooks, hooks, and campaigns by vertical. Click a card to expand details.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
        )}

        {/* Vertical Grid */}
        {loading ? (
          <div className="text-gray-400 text-center py-20">Loading verticals…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {VERTICALS_META.map(meta => {
              const data = verticalMap[meta.slug];
              const isOpen = expanded === meta.slug;
              const pb = playbooks[meta.slug];
              return (
                <div key={meta.slug} className={`border-2 rounded-xl overflow-hidden ${meta.color}`}>
                  {/* Card header */}
                  <button
                    onClick={() => toggleExpand(meta.slug)}
                    className="w-full text-left p-4 flex items-start justify-between hover:opacity-80 transition"
                  >
                    <div>
                      <div className="text-2xl mb-1">{meta.icon}</div>
                      <div className="font-semibold text-gray-900 text-lg">{meta.name}</div>
                      {data ? (
                        <div className="text-xs text-gray-600 mt-1">
                          {data.campaigns_count} campaigns · {data.hooks_count} hooks
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mt-1">No data yet</div>
                      )}
                    </div>
                    <span className="text-gray-500 text-lg mt-1">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded playbook */}
                  {isOpen && (
                    <div className="bg-white border-t border-gray-200 p-4">
                      {playbookLoading === meta.slug ? (
                        <p className="text-gray-400 text-sm">Loading playbook…</p>
                      ) : pb ? (
                        <div className="space-y-3">
                          {pb.playbook?.summary && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Playbook Summary</div>
                              <p className="text-sm text-gray-700">{pb.playbook.summary}</p>
                            </div>
                          )}
                          {pb.playbook?.phases && pb.playbook.phases.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Phases</div>
                              {pb.playbook.phases.map((ph, i) => (
                                <div key={i} className="mb-2">
                                  <div className="text-xs font-medium text-gray-700">{ph.name}</div>
                                  <ul className="list-disc list-inside text-xs text-gray-600 ml-2">
                                    {ph.actions.map((a, j) => <li key={j}>{a}</li>)}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}
                          {pb.hooks.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Top Hooks</div>
                              <ul className="text-xs text-gray-600 space-y-1">
                                {pb.hooks.slice(0, 5).map((h, i) => (
                                  <li key={i} className="bg-gray-50 rounded px-2 py-1">"{h}"</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {pb.campaigns.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Campaigns</div>
                              <ul className="text-xs text-gray-600 space-y-1">
                                {pb.campaigns.slice(0, 4).map(c => (
                                  <li key={c.id} className="flex justify-between">
                                    <span>{c.name}</span>
                                    <span className={`px-1.5 rounded text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <a
                            href={`/admin/industry-verticals/${meta.slug}`}
                            className="inline-block mt-2 text-xs font-medium text-blue-600 hover:underline"
                          >
                            Full Vertical Page →
                          </a>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">No playbook data available.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Ollama AI Hook Generator */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Hook Generator (Ollama)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Select Vertical</label>
              <select
                value={ollamaSlug}
                onChange={e => setOllamaSlug(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
              >
                <option value="">— choose —</option>
                {VERTICALS_META.map(v => (
                  <option key={v.slug} value={v.slug}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Context / Goal</label>
              <input
                type="text"
                value={ollamaPrompt}
                onChange={e => setOllamaPrompt(e.target.value)}
                placeholder="e.g. Black Friday promotion targeting millennials"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={generateHooks}
            disabled={ollamaLoading || !ollamaSlug || !ollamaPrompt}
            className="px-5 py-2 bg-indigo-600 text-white rounded font-medium text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {ollamaLoading ? 'Generating…' : 'Generate Hooks'}
          </button>
          {ollamaResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
              {ollamaResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
