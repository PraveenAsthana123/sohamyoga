'use client';
// Market Research, Competitor Intelligence & Pricing — Competitor Price
// Tracker. No external API can honestly fetch a competitor's real pricing,
// so this is the real, buildable slice: admin-entered competitor pricing
// data-entry + history, compared against our own real pricing_plan_master
// data (never a fabricated live-scraper, never invented "our" numbers).

import { useEffect, useState, useCallback } from 'react';

interface PricePoint { id: string; competitor_id: string; service_name: string; price: string; currency: string; effective_date: string; notes: string; created_at: string }
interface CompetitorRow { id: string; name: string; website: string | null; notes: string; created_at: string; pricePoints: PricePoint[] }
interface OurPrice { service_name: string; price: string; currency: string; billing_cycle: string }

function NewCompetitorForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [website, setWebsite] = useState(''); const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/competitors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, website: website || undefined, notes }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setName(''); setWebsite(''); setNotes(''); onCreated(); }
    else setError(body.error ?? 'Failed to create competitor.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Competitor</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-lg">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Competitor name" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="Website (https://...)" className="w-full border rounded px-2 py-1.5 text-sm" />
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" className="w-full border rounded px-2 py-1.5 text-sm" rows={2} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button onClick={handleCreate} disabled={busy || !name} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

function NewPricePointForm({ competitorId, onCreated }: { competitorId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [serviceName, setServiceName] = useState(''); const [price, setPrice] = useState(''); const [currency, setCurrency] = useState('CAD');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10)); const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/competitors/${competitorId}/price-points`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceName, price: Number(price), currency, effectiveDate, notes }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setServiceName(''); setPrice(''); setNotes(''); onCreated(); }
    else setError(body.error ?? 'Failed to record price point.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-indigo-600 hover:underline">+ Add price point</button>;
  return (
    <div className="mt-2 bg-gray-50 border rounded p-3 space-y-2">
      <div className="flex gap-2">
        <input value={serviceName} onChange={e => setServiceName(e.target.value)} placeholder="Service (e.g. Monthly Unlimited)" className="flex-1 border rounded px-2 py-1 text-xs" />
        <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="Price" className="w-24 border rounded px-2 py-1 text-xs" />
        <input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="CAD" className="w-16 border rounded px-2 py-1 text-xs" />
      </div>
      <div className="flex gap-2">
        <input value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} type="date" className="border rounded px-2 py-1 text-xs" />
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (source, plan details...)" className="flex-1 border rounded px-2 py-1 text-xs" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy || !serviceName || !price} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs disabled:opacity-50">Save</button>
        <button onClick={() => setOpen(false)} className="px-2 py-1 text-xs text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function CompetitorsAdmin() {
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [ourPricing, setOurPricing] = useState<OurPrice[]>([]);
  const [pricingDigest, setPricingDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/competitors', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setCompetitors(d?.competitors ?? []); setOurPricing(d?.ourPricing ?? []); setPricingDigest(d?.pricingDigest ?? null); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Market Intelligence — Competitor & Pricing</h1><p className="text-sm text-gray-500">Real, admin-researched competitor pricing compared against our own real plan pricing, plus the weekly AI pricing advisory. No trend or opportunity-scoring layer exists yet — not fabricated here. No external scraper; no fabricated data.</p></div>
        <NewCompetitorForm onCreated={load} />
      </div>

      {pricingDigest && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-800 mb-1">AI Pricing Advisory (weekly, fact-checked against our live pricing)</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{pricingDigest}</p>
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-gray-800 mb-2">Our pricing (from pricing_plan_master)</p>
        {ourPricing.length ? (
          <div className="flex flex-wrap gap-2">
            {ourPricing.map((p, i) => (
              <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                {p.service_name} — {p.currency} {Number(p.price).toFixed(2)} / {p.billing_cycle}
              </span>
            ))}
          </div>
        ) : <p className="text-xs text-gray-400">No active pricing plans found.</p>}
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {competitors.map(c => (
            <div key={c.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{c.name}</p>
                  {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">{c.website}</a>}
                  {c.notes && <p className="text-xs text-gray-400 mt-1">{c.notes}</p>}
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {c.pricePoints.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-gray-50 rounded p-2">
                    <span className="text-gray-700">{p.service_name} — {p.currency} {Number(p.price).toFixed(2)}</span>
                    <span className="text-gray-400">effective {p.effective_date?.slice(0, 10)}</span>
                  </div>
                ))}
                {!c.pricePoints.length && <p className="text-xs text-gray-400">No price points recorded yet.</p>}
              </div>
              <NewPricePointForm competitorId={c.id} onCreated={load} />
            </div>
          ))}
          {!competitors.length && <p className="text-sm text-gray-400">No competitors yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}
