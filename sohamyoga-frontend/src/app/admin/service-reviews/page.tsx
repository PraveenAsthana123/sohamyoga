'use client';
// Review, Rating & Reputation Management — on-site review moderation.
// Distinct from /admin/reputation (Google Business Profile sync, external
// third-party reviews). This is the studio's OWN on-site review collection,
// tied to a real completed (checked_in) booking — real integrity control
// against review-bombing, not an open form.

import { useEffect, useState, useCallback } from 'react';

interface ReviewRow {
  id: string; booking_id: string; reviewer_name: string; reviewer_email: string; star_rating: number;
  comment: string; status: string; staff_response: string | null; responded_at: string | null; created_at: string;
  class_name: string; teacher_name: string; session_date: string;
}

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
}

// AI Response Draft -- Ollama suggests a reply from the review's own real
// content; staff always reviews/edits before sending. Never auto-sends.
function RespondBox({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState('');

  async function submit() {
    setBusy(true);
    await fetch(`/api/service-reviews/${id}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffResponse: text }),
    });
    setBusy(false); setOpen(false); setText(''); onDone();
  }

  async function draftWithAi() {
    setDrafting(true); setDraftError('');
    const res = await fetch(`/api/service-reviews/${id}/draft-response`, { method: 'POST' });
    const body = await res.json();
    setDrafting(false);
    if (!res.ok) { setDraftError(body.error || 'Failed to draft a response.'); return; }
    setText(body.draft);
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-indigo-600 hover:underline">Respond</button>;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Staff response…" className="flex-1 border rounded px-2 py-1 text-xs" />
        <button onClick={draftWithAi} disabled={drafting} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs disabled:opacity-50">{drafting ? 'Drafting…' : 'Draft with AI'}</button>
        <button onClick={submit} disabled={busy || !text.trim()} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs disabled:opacity-50">Send</button>
      </div>
      {draftError && <p className="text-xs text-red-600">{draftError}</p>}
    </div>
  );
}

interface RecoveryCase {
  id: string; status: string; contactMethod: string | null; notes: string | null; resolvedAt: string | null;
  createdAt: string; starRating: number; comment: string; reviewerName: string; reviewerEmail: string; className: string;
}

const RECOVERY_STATUS_COLOR: Record<string, string> = {
  identified: 'bg-red-100 text-red-700', contacted: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700', unresolved: 'bg-gray-100 text-gray-600',
};
const RECOVERY_NEXT: Record<string, string[]> = {
  identified: ['contacted'], contacted: ['resolved', 'unresolved'], resolved: [], unresolved: ['contacted'],
};

// Real Service Recovery -- a case is auto-opened whenever a review scores
// <=2 stars (POST /api/service-reviews). No AI decides resolution -- a
// human records contact_method/notes, same as every other closure here.
function ServiceRecoveryPanel() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [contactMethod, setContactMethod] = useState('phone');
  const [notes, setNotes] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/service-recovery', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setCases(d?.cases ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, status: string) {
    await fetch(`/api/admin/service-recovery/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, contactMethod: status === 'contacted' ? contactMethod : undefined, notes: notes || undefined }),
    });
    setActingId(null); setNotes('');
    load();
  }

  const open = cases.filter(c => c.status !== 'resolved');

  return (
    <div className="bg-white border rounded-lg p-4 mb-6">
      <h2 className="font-semibold text-gray-900 mb-1">Service Recovery ({open.length} open)</h2>
      <p className="text-xs text-gray-500 mb-3">Auto-opened whenever a review scores 2 stars or fewer.</p>
      {loading ? <p className="text-xs text-gray-400">Loading…</p> : (
        <div className="space-y-2">
          {cases.map(c => (
            <div key={c.id} className="border rounded p-3 text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{c.reviewerName} — <Stars n={c.starRating} /> — {c.className}</p>
                  {c.comment && <p className="text-xs text-gray-500 mt-1">{c.comment}</p>}
                  {c.notes && <p className="text-xs text-indigo-700 bg-indigo-50 rounded p-1.5 mt-1">{c.notes}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${RECOVERY_STATUS_COLOR[c.status]}`}>{c.status}</span>
              </div>
              {actingId === c.id ? (
                <div className="flex gap-2 mt-2 items-center">
                  <select value={contactMethod} onChange={e => setContactMethod(e.target.value)} className="border rounded px-1.5 py-1 text-xs">
                    {['phone', 'email', 'in_person'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes…" className="flex-1 border rounded px-2 py-1 text-xs" />
                  <button onClick={() => transition(c.id, 'contacted')} className="text-xs text-blue-600 hover:underline">Confirm</button>
                  <button onClick={() => setActingId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                </div>
              ) : (
                <div className="flex gap-2 mt-2">
                  {(RECOVERY_NEXT[c.status] ?? []).map(s => (
                    <button key={s} onClick={() => s === 'contacted' ? setActingId(c.id) : transition(c.id, s)} className="text-xs text-blue-600 hover:underline">{s}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!cases.length && <p className="text-xs text-gray-400">No recovery cases yet.</p>}
        </div>
      )}
    </div>
  );
}

export default function ServiceReviewsAdmin() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'hidden'>('all');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/service-reviews', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setReviews(d?.reviews ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function transition(id: string, action: 'publish' | 'hide') {
    await fetch(`/api/service-reviews/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load();
  }

  const visible = reviews.filter(r => filter === 'all' || r.status === filter);
  const published = reviews.filter(r => r.status === 'published');
  const avg = published.length ? (published.reduce((s, r) => s + r.star_rating, 0) / published.length) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">On-Site Reviews</h1><p className="text-sm text-gray-500">Real reviews from real checked-in bookings — moderate, respond, and see the real aggregate rating.</p></div>
        <div className="text-right">
          <p className="text-2xl font-bold text-amber-600">{avg ? avg.toFixed(1) : '—'} <span className="text-sm text-gray-400 font-normal">/ 5</span></p>
          <p className="text-xs text-gray-400">{published.length} published review{published.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <ServiceRecoveryPanel />
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'published', 'hidden'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded text-sm capitalize ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{f}</button>
        ))}
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {visible.map(r => (
            <div key={r.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{r.reviewer_name} <Stars n={r.star_rating} /></p>
                  <p className="text-xs text-gray-400">{r.class_name} with {r.teacher_name} · {new Date(r.session_date).toLocaleDateString()}</p>
                  {r.comment && <p className="text-sm text-gray-700 mt-2">{r.comment}</p>}
                  {r.staff_response && <p className="text-xs text-indigo-700 bg-indigo-50 rounded p-2 mt-2">Staff response: {r.staff_response}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'published' ? 'bg-green-100 text-green-700' : r.status === 'hidden' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
              </div>
              <div className="flex gap-2 mt-2 items-center">
                {r.status !== 'published' && <button onClick={() => transition(r.id, 'publish')} className="text-xs text-green-600 hover:underline">Publish</button>}
                {r.status !== 'hidden' && <button onClick={() => transition(r.id, 'hide')} className="text-xs text-gray-400 hover:underline">Hide</button>}
                {!r.staff_response && <RespondBox id={r.id} onDone={load} />}
              </div>
            </div>
          ))}
          {!visible.length && <p className="text-sm text-gray-400">No reviews yet.</p>}
        </div>
      )}
    </div>
  );
}
