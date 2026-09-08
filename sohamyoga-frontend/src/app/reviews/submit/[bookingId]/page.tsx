'use client';
// Real customer-facing review submission -- previously the POST
// /api/service-reviews route existed with zero UI anywhere that called it.
// Reached via a real review-request notification link
// (src/cron/jobs/ReviewRequestJob.ts); the booking's own UUID is the access
// token, same pattern as a magic link.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Context { className: string; teacherName: string; sessionDate: string; alreadyReviewed: boolean; reviewerEmail: string }

export default function SubmitReviewPage() {
  const params = useParams();
  const bookingId = params.bookingId as string;
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [starRating, setStarRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}/review-context`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setContext(d); })
      .catch(e => setError(e.message));
  }, [bookingId]);

  async function submit() {
    if (!context) return;
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/service-reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, reviewerName, reviewerEmail: context.reviewerEmail, starRating, comment }),
    });
    const body = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(body.error || 'Failed to submit review.'); return; }
    setSubmitted(true);
  }

  if (error) return <div className="mx-auto max-w-lg p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!context) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (context.alreadyReviewed || submitted) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border bg-white p-6 text-center">
          <p className="text-lg font-semibold text-gray-800">Thank you!</p>
          <p className="mt-1 text-sm text-gray-500">{submitted ? 'Your review has been submitted and is pending moderation.' : 'You have already reviewed this class.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="rounded-xl border bg-white p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">How was your class?</h1>
          <p className="text-sm text-gray-500 mt-1">{context.className} with {context.teacherName} on {new Date(context.sessionDate).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-1 text-3xl">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setStarRating(n)} className={n <= starRating ? 'text-amber-500' : 'text-gray-300'}>★</button>
          ))}
        </div>
        <input value={reviewerName} onChange={e => setReviewerName(e.target.value)} placeholder="Your name" className="w-full border rounded px-3 py-2 text-sm" />
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Tell us about your experience (optional)" rows={4} className="w-full border rounded px-3 py-2 text-sm" />
        <button onClick={submit} disabled={submitting || !reviewerName.trim() || starRating === 0} className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>
    </div>
  );
}
