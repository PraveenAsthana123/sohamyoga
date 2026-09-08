'use client';

// Public customer-facing service catalog — browse + inquire, no checkout.
// No payment gateway exists anywhere in this codebase, so a "Buy Now" button
// would either fake a charge or do nothing; inquiries route through the
// real, existing /api/leads/capture path instead (marketing_form_link slug
// "service-catalog", seeded in db-schema-service-catalog.sql).

import { useEffect, useState } from 'react';

interface ServiceItem {
  id: string; category: string; name: string; description: string; price_note: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  market_research: 'Market Research', digital_marketing: 'Digital Marketing',
};

export default function ServicesPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [category, setCategory] = useState<'all' | 'market_research' | 'digital_marketing'>('all');
  const [inquiring, setInquiring] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/service-catalog', { cache: 'no-store' }).then(r => r.json()).then(d => setItems(d.items ?? []));
  }, []);

  const filtered = category === 'all' ? items : items.filter(i => i.category === category);

  async function submitInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiring) return;
    const r = await fetch('/api/leads/capture', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'service-catalog', serviceItemId: inquiring.id, ...form }),
    });
    setStatus(r.ok ? 'Thanks — we received your inquiry and will follow up.' : 'Something went wrong. Please try again.');
    if (r.ok) { setInquiring(null); setForm({ name: '', email: '', message: '' }); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Our Services</h1>
        <p className="text-sm text-gray-500">Browse Market Research and Digital Marketing services. Select one to send an inquiry — no payment is collected here.</p>
      </div>

      <select value={category} onChange={e => setCategory(e.target.value as any)} className="rounded border px-3 py-2 text-sm">
        <option value="all">All categories</option>
        <option value="market_research">Market Research</option>
        <option value="digital_marketing">Digital Marketing</option>
      </select>

      <div className="space-y-3">
        {filtered.map(item => (
          <div key={item.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{CATEGORY_LABELS[item.category]}</span>
                <h2 className="mt-1 font-semibold">{item.name}</h2>
                <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                {item.price_note && <p className="mt-1 text-sm text-gray-500">{item.price_note}</p>}
              </div>
              <button onClick={() => { setInquiring(item); setStatus(''); }} className="shrink-0 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Inquire</button>
            </div>
          </div>
        ))}
        {!filtered.length && <p className="text-sm text-gray-400">No services published yet.</p>}
      </div>

      {inquiring && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4">
          <form onSubmit={submitInquiry} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5">
            <h3 className="font-semibold">Inquire: {inquiring.name}</h3>
            <input required placeholder="Your name" className="w-full rounded border p-2 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input required type="email" placeholder="Email" className="w-full rounded border p-2 text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <textarea placeholder="Message (optional)" className="w-full rounded border p-2 text-sm" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setInquiring(null)} className="rounded px-3 py-1.5 text-sm text-gray-500">Cancel</button>
              <button type="submit" className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Send inquiry</button>
            </div>
          </form>
        </div>
      )}
      {status && <p className="text-sm text-emerald-700">{status}</p>}
    </div>
  );
}
