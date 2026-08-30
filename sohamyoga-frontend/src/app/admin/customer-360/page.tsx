'use client';
// Module 22 — CRM, Customer 360, CDP & Master Customer Data Management. Was
// 2/15 real: a person's real activity was scattered across customer,
// student, campaign_lead, journey_touchpoint, booking, service_review,
// event_registration, and survey_response with no unifying view. This page
// is a live read-aggregation (GET /api/admin/customer-360?email=) — nothing
// here is stored redundantly; every lookup re-queries the real tables.

import { useState, useCallback } from 'react';

interface TimelineEntry {
  source: string; sourceTable: string; type: string; occurredAt: string; label: string; detail: Record<string, unknown>;
}
interface Customer360Response {
  email: string;
  found: boolean;
  identity: { displayName: string | null; email: string; phone: string | null } | null;
  customer: { id: string; tier: string; loyaltyPoints: number; lifetimeSpendCad: number; emailOptIn: boolean; smsOptIn: boolean; createdAt: string } | null;
  student: { id: string; status: string; journeyPhase: string; experienceLevel: string; enrolledAt: string } | null;
  leads: Array<{ id: string; sourcePlatform: string | null; funnelStage: string; convertedAt: string | null; createdAt: string }>;
  stats: {
    lifetimeSpendCad: number | null; loyaltyPoints: number | null; totalBookings: number;
    avgReviewRating: number | null; reviewCount: number; funnelStage: string | null;
    totalEventRegistrations: number; totalSurveyResponses: number; totalTouchpoints: number;
  };
  timeline: TimelineEntry[];
  formSubmissions: { included: boolean; note: string };
}

const SOURCE_STYLE: Record<string, { icon: string; color: string }> = {
  journey_touchpoint: { icon: '→', color: 'bg-indigo-100 text-indigo-700' },
  booking: { icon: '📅', color: 'bg-blue-100 text-blue-700' },
  booking_checkin: { icon: '✓', color: 'bg-green-100 text-green-700' },
  service_review: { icon: '★', color: 'bg-amber-100 text-amber-700' },
  event_registration: { icon: '🎟', color: 'bg-purple-100 text-purple-700' },
  survey_response: { icon: '📝', color: 'bg-teal-100 text-teal-700' },
  campaign_lead: { icon: '🎯', color: 'bg-pink-100 text-pink-700' },
  form_submission: { icon: '📄', color: 'bg-gray-100 text-gray-700' },
};

export default function Customer360Admin() {
  const [emailInput, setEmailInput] = useState('');
  const [result, setResult] = useState<Customer360Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    const email = emailInput.trim();
    if (!email) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/admin/customer-360?email=${encodeURIComponent(email)}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? 'Lookup failed.'); return; }
      setResult(body);
    } finally {
      setLoading(false);
    }
  }, [emailInput]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Customer 360</h1>
      <p className="text-sm text-gray-500 mb-6">
        Real live read-aggregation across customer, student, campaign_lead, journey_touchpoint, booking,
        service_review, event_registration, survey_response, and form_submission. No data is duplicated —
        every search re-queries the real tables.
      </p>

      <div className="flex gap-2 mb-6">
        <input
          value={emailInput}
          onChange={e => setEmailInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search by email address…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={search} disabled={loading || !emailInput.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {result && !result.found && (
        <div className="bg-white border rounded-lg p-6 text-center">
          <p className="text-sm text-gray-500">No record of <span className="font-mono">{result.email}</span> found in customer, student, lead, touchpoint, booking, review, event registration, survey, or form submission tables.</p>
        </div>
      )}

      {result && result.found && (
        <div className="space-y-6">
          {/* Identity header */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900">{result.identity?.displayName ?? '(name unknown)'}</p>
                <p className="text-sm text-gray-500 font-mono">{result.identity?.email}</p>
                {result.identity?.phone && <p className="text-sm text-gray-500">{result.identity.phone}</p>}
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end">
                {result.customer && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">customer · {result.customer.tier}</span>}
                {result.student && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">student · {result.student.status}</span>}
                {result.leads.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">{result.leads.length} lead record{result.leads.length > 1 ? 's' : ''}</span>}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Lifetime spend" value={result.stats.lifetimeSpendCad != null ? `$${result.stats.lifetimeSpendCad.toFixed(2)} CAD` : '—'} />
            <StatTile label="Loyalty points" value={result.stats.loyaltyPoints != null ? String(result.stats.loyaltyPoints) : '—'} />
            <StatTile label="Total bookings" value={String(result.stats.totalBookings)} />
            <StatTile label="Avg review rating" value={result.stats.avgReviewRating != null ? `${result.stats.avgReviewRating.toFixed(2)} ★ (${result.stats.reviewCount})` : '—'} />
            <StatTile label="Funnel stage" value={result.stats.funnelStage ?? '—'} />
            <StatTile label="Event registrations" value={String(result.stats.totalEventRegistrations)} />
            <StatTile label="Survey responses" value={String(result.stats.totalSurveyResponses)} />
            <StatTile label="Journey touchpoints" value={String(result.stats.totalTouchpoints)} />
          </div>

          {!result.formSubmissions.included && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">{result.formSubmissions.note}</p>
          )}

          {/* Timeline */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <h3 className="font-semibold text-gray-800 p-4 pb-2">Unified timeline ({result.timeline.length})</h3>
            <div className="divide-y">
              {result.timeline.map((entry, i) => {
                const style = SOURCE_STYLE[entry.source] ?? { icon: '•', color: 'bg-gray-100 text-gray-700' };
                return (
                  <div key={i} className="p-3 flex items-start gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${style.color}`}>{style.icon} {entry.sourceTable}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{entry.label}</p>
                      <p className="text-xs text-gray-400">{new Date(entry.occurredAt).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
              {!result.timeline.length && <p className="text-sm text-gray-400 p-4">No timeline activity found for this person yet.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}
