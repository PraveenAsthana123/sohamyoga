'use client';
// Customer Journey, Funnel & Conversion Management — real per-contact
// touchpoint timeline. Extends the existing funnel_stage_snapshot engine
// (src/domain/funnel) rather than duplicating it: this is the unified,
// individual-level touchpoint log that engine never had, wired from two
// real flows (form submission, event registration) so it holds real data,
// not fabricated history.

import { useState } from 'react';

interface Touchpoint { id: string; contact_identifier: string; touchpoint_type: string; source_module: string; occurred_at: string; metadata: Record<string, unknown> }

const TYPE_LABEL: Record<string, string> = {
  form_submission: 'Form submission', event_registration: 'Event registration', booking: 'Booking',
  campaign_email: 'Campaign email', landing_page_view: 'Landing page view', survey_response: 'Survey response',
};

export default function JourneyAdmin() {
  const [contact, setContact] = useState('');
  const [touchpoints, setTouchpoints] = useState<Touchpoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!contact.trim()) return;
    setLoading(true); setError(null);
    const res = await fetch(`/api/journey?contact=${encodeURIComponent(contact.trim())}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) setTouchpoints(body.touchpoints ?? []);
    else { setError(body.error ?? 'Search failed.'); setTouchpoints(null); }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customer Journey Timeline</h1>
        <p className="text-sm text-gray-500">Real, per-contact chronological touchpoint history — search by email. Wired from real form submissions and event registrations (more sources as flows are connected).</p>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          value={contact} onChange={e => setContact(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="contact email" className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button onClick={search} disabled={loading || !contact.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">Search</button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {touchpoints !== null && !loading && (
        <div className="space-y-3">
          {touchpoints.map(tp => (
            <div key={tp.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <p className="font-medium text-gray-800">{TYPE_LABEL[tp.touchpoint_type] ?? tp.touchpoint_type}</p>
                <span className="text-xs text-gray-400">{new Date(tp.occurred_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">source: {tp.source_module}</p>
              {Object.keys(tp.metadata ?? {}).length > 0 && (
                <pre className="text-xs text-gray-500 bg-gray-50 rounded p-2 mt-2 overflow-x-auto">{JSON.stringify(tp.metadata, null, 2)}</pre>
              )}
            </div>
          ))}
          {!touchpoints.length && <p className="text-sm text-gray-400">No touchpoints found for this contact yet.</p>}
        </div>
      )}
    </div>
  );
}
