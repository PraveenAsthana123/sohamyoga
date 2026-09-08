'use client';
// Brand Strategy Screen + Brand Positioning Map + Brand Architecture --
// the strategic layer above the operational brand_kit governance at
// /admin/brand-kits (logo/color/typography rules). This page covers
// mission/vision/audience, a real price-vs-quality positioning quadrant
// (staff-entered competitor data, not fabricated market research), and
// the real brand_kit hierarchy (main brand vs sub/seasonal kits).

import { useCallback, useEffect, useState } from 'react';

interface Strategy { mission: string; vision: string; targetAudience: string; keyDifferentiators: string[] }
interface ArchitectureNode { id: string; name: string; isDefault: boolean; primaryColor: string }
interface Architecture { main: ArchitectureNode | null; subBrands: ArchitectureNode[] }
interface PositioningEntry { id: string; label: string; isSelf: boolean; pricePosition: number; qualityPosition: number; notes: string }

function StrategyForm() {
  const [strategy, setStrategy] = useState<Strategy>({ mission: '', vision: '', targetAudience: '', keyDifferentiators: [] });
  const [diffInput, setDiffInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/brand-strategy', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.strategy) setStrategy(d.strategy); })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaved(false);
    await fetch('/api/admin/brand-strategy', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(strategy),
    });
    setSaved(true);
  }

  function addDifferentiator() {
    if (!diffInput.trim()) return;
    setStrategy(s => ({ ...s, keyDifferentiators: [...s.keyDifferentiators, diffInput.trim()] }));
    setDiffInput('');
  }

  if (loading) return <p className="text-sm text-gray-400">Loading strategy…</p>;

  return (
    <div className="bg-white border rounded-lg p-5 space-y-3">
      <h2 className="font-semibold text-gray-900">Brand Strategy</h2>
      <div>
        <label className="text-xs font-medium text-gray-500">Mission</label>
        <textarea value={strategy.mission} onChange={e => setStrategy(s => ({ ...s, mission: e.target.value }))}
          rows={2} className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="Why this studio exists…" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Vision</label>
        <textarea value={strategy.vision} onChange={e => setStrategy(s => ({ ...s, vision: e.target.value }))}
          rows={2} className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="Where the studio is headed…" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Target Audience</label>
        <textarea value={strategy.targetAudience} onChange={e => setStrategy(s => ({ ...s, targetAudience: e.target.value }))}
          rows={2} className="w-full border rounded px-2 py-1.5 text-sm mt-1" placeholder="Who this studio serves…" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Key Differentiators</label>
        <div className="flex flex-wrap gap-1.5 mt-1 mb-1.5">
          {strategy.keyDifferentiators.map((d, i) => (
            <span key={i} className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-1 flex items-center gap-1">
              {d}
              <button onClick={() => setStrategy(s => ({ ...s, keyDifferentiators: s.keyDifferentiators.filter((_, j) => j !== i) }))} className="text-indigo-400 hover:text-indigo-700">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input value={diffInput} onChange={e => setDiffInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDifferentiator()}
            placeholder="Add a differentiator…" className="flex-1 border rounded px-2 py-1 text-xs" />
          <button onClick={addDifferentiator} className="text-xs bg-gray-100 px-2 py-1 rounded">Add</button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={save} className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700">Save Strategy</button>
        {saved && <span className="text-xs text-green-600">Saved.</span>}
      </div>
    </div>
  );
}

function PositioningMap() {
  const [entries, setEntries] = useState<PositioningEntry[]>([]);
  const [form, setForm] = useState({ label: '', isSelf: false, pricePosition: 5, qualityPosition: 5, notes: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/admin/brand-strategy/positioning', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setEntries(d?.entries ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    setError('');
    if (!form.label.trim()) { setError('Label is required.'); return; }
    const res = await fetch('/api/admin/brand-strategy/positioning', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b.error ?? 'Failed to add.'); return; }
    setForm({ label: '', isSelf: false, pricePosition: 5, qualityPosition: 5, notes: '' });
    load();
  }
  async function remove(id: string) {
    await fetch(`/api/admin/brand-strategy/positioning/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="bg-white border rounded-lg p-5 space-y-3">
      <h2 className="font-semibold text-gray-900">Brand Positioning Map</h2>
      <p className="text-xs text-gray-500">Price (low → high) vs. perceived quality/premium (low → high). Staff-entered — not automated market data.</p>
      <div className="relative border rounded-lg bg-gray-50" style={{ aspectRatio: '1 / 1' }}>
        <div className="absolute inset-0 border-t border-l border-gray-300" style={{ top: '50%', left: 0, right: 0, height: 1 }} />
        <div className="absolute inset-0" style={{ left: '50%', top: 0, bottom: 0, width: 1, background: '#d1d5db' }} />
        {entries.map(e => (
          <div key={e.id}
            className={`absolute -translate-x-1/2 translate-y-1/2 flex flex-col items-center group`}
            style={{ left: `${(e.pricePosition / 10) * 100}%`, bottom: `${(e.qualityPosition / 10) * 100}%` }}>
            <div className={`w-3 h-3 rounded-full ${e.isSelf ? 'bg-indigo-600 ring-2 ring-indigo-200' : 'bg-gray-400'}`} />
            <span className={`text-[10px] mt-0.5 whitespace-nowrap ${e.isSelf ? 'font-semibold text-indigo-700' : 'text-gray-500'}`}>{e.label}</span>
          </div>
        ))}
        <span className="absolute bottom-1 left-1 text-[10px] text-gray-400">Low price</span>
        <span className="absolute bottom-1 right-1 text-[10px] text-gray-400">High price</span>
        <span className="absolute top-1 left-1 text-[10px] text-gray-400">High quality</span>
      </div>
      <div className="space-y-1">
        {entries.map(e => (
          <div key={e.id} className="flex justify-between items-center text-xs bg-gray-50 rounded px-2 py-1">
            <span>{e.isSelf ? '★ ' : ''}{e.label} — price {e.pricePosition}/10, quality {e.qualityPosition}/10{e.notes ? ` — ${e.notes}` : ''}</span>
            <button onClick={() => remove(e.id)} className="text-red-500 hover:underline">Remove</button>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2 items-end">
        <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Competitor / studio name" className="border rounded px-2 py-1 text-xs col-span-2" />
        <label className="text-xs text-gray-500">Price 1-10<input type="number" min={1} max={10} value={form.pricePosition} onChange={e => setForm(f => ({ ...f, pricePosition: Number(e.target.value) }))} className="w-full border rounded px-2 py-1 text-xs mt-0.5" /></label>
        <label className="text-xs text-gray-500">Quality 1-10<input type="number" min={1} max={10} value={form.qualityPosition} onChange={e => setForm(f => ({ ...f, qualityPosition: Number(e.target.value) }))} className="w-full border rounded px-2 py-1 text-xs mt-0.5" /></label>
        <label className="text-xs flex items-center gap-1 col-span-2"><input type="checkbox" checked={form.isSelf} onChange={e => setForm(f => ({ ...f, isSelf: e.target.checked }))} /> This is our own studio</label>
        <button onClick={add} className="text-xs bg-indigo-600 text-white px-2 py-1.5 rounded col-span-2">Add to map</button>
      </div>
    </div>
  );
}

function ArchitectureView() {
  const [architecture, setArchitecture] = useState<Architecture | null>(null);

  useEffect(() => {
    fetch('/api/admin/brand-strategy', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setArchitecture(d?.architecture ?? null));
  }, []);

  return (
    <div className="bg-white border rounded-lg p-5 space-y-2">
      <h2 className="font-semibold text-gray-900">Brand Architecture</h2>
      {!architecture ? <p className="text-sm text-gray-400">Loading…</p> : !architecture.main ? (
        <p className="text-sm text-gray-400">No default brand kit set yet — configure one at /admin/brand-kits.</p>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: architecture.main.primaryColor }} />
            <span className="font-medium text-gray-800">{architecture.main.name}</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">Main brand</span>
          </div>
          {architecture.subBrands.length > 0 && (
            <div className="ml-5 mt-2 space-y-1 border-l pl-3">
              {architecture.subBrands.map(b => (
                <div key={b.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.primaryColor }} />
                  {b.name}
                </div>
              ))}
            </div>
          )}
          {!architecture.subBrands.length && <p className="text-xs text-gray-400 mt-1">No sub-brands or seasonal kits configured.</p>}
        </div>
      )}
    </div>
  );
}

export default function BrandStrategyPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Brand Strategy</h1>
        <p className="text-sm text-gray-500 mt-0.5">Mission, positioning, and brand architecture — the strategic layer above brand-kit governance.</p>
      </div>
      <StrategyForm />
      <PositioningMap />
      <ArchitectureView />
    </div>
  );
}
