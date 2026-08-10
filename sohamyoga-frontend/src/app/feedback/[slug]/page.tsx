'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface Question { id: string; type: string; text: string; required: boolean; ratingMin?: number; ratingMax?: number }
interface SurveyData { confirmationMessage: string | null; questions: Question[] }

export default function FeedbackPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? undefined;

  const [data, setData] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/survey/${params.slug}/respond`)
      .then(async r => {
        if (!r.ok) { setError((await r.json().catch(() => null))?.error ?? 'This feedback form is not available.'); return; }
        setData(await r.json());
      })
      .finally(() => setLoading(false));
  }, [params.slug]);

  const npsQuestion = data?.questions.find(q => q.type === 'nps');
  const textQuestion = data?.questions.find(q => q.type === 'long_text');

  async function submit() {
    if (score === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/${params.slug}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, npsScore: score, reasonText: reason.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? 'Something went wrong. Please try again.'); return; }
      setSubmitted(body.confirmationMessage ?? 'Thank you for your feedback!');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : submitted ? (
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">Thank you!</h1>
          <p className="text-gray-600">{submitted}</p>
        </div>
      ) : error && !data ? (
        <p className="text-gray-600">{error}</p>
      ) : (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-gray-900">We&apos;d love your feedback</h1>
          {npsQuestion && (
            <div>
              <p className="font-medium text-gray-800 mb-3">{npsQuestion.text}</p>
              <div className="flex gap-1 flex-wrap" role="radiogroup" aria-label={npsQuestion.text}>
                {Array.from({ length: (npsQuestion.ratingMax ?? 10) - (npsQuestion.ratingMin ?? 0) + 1 }, (_, i) => (npsQuestion.ratingMin ?? 0) + i).map(n => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={score === n}
                    onClick={() => setScore(n)}
                    className={`h-10 w-10 rounded-lg border text-sm font-medium transition-colors ${
                      score === n ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Not at all likely</span>
                <span>Extremely likely</span>
              </div>
            </div>
          )}
          {textQuestion && (
            <div>
              <label htmlFor="reason" className="font-medium text-gray-800 mb-2 block">{textQuestion.text}</label>
              <textarea
                id="reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={4000}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={score === null || submitting}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Submit feedback'}
          </button>
        </div>
      )}
    </main>
  );
}
