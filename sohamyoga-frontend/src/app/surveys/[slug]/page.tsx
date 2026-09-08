'use client';
// /surveys/[slug] -- public survey response page for the general Survey
// Builder (admin creates at /admin/surveys). Previously a survey could be
// created for real but nothing let anyone answer it.

import { useEffect, useState } from 'react';

interface Question { id: string; type: string; text: string; required: boolean; ratingMin?: number; ratingMax?: number; options: string[] }
interface SurveyData { id: string; title: string; description: string | null; consentRequired: boolean; consentText: string; questions: Question[] }

const CHOICE_TYPES = new Set(['single_choice', 'multiple_choice', 'checkbox']);

export default function SurveyResponsePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/surveys/${slug}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setSurvey(d); })
      .catch(e => setError(e.message));
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!survey) return;
    setSubmitting(true);
    setError('');
    const res = await fetch(`/api/surveys/${slug}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email || undefined, consent,
        answers: survey.questions.map(q => {
          const raw = answers[q.id] ?? '';
          if (q.type === 'rating_scale' || q.type === 'number') return { questionId: q.id, valueNumber: raw ? Number(raw) : undefined };
          if (q.type === 'checkbox' || q.type === 'multiple_choice') return { questionId: q.id, valueArray: raw ? raw.split(',') : [] };
          return { questionId: q.id, valueText: raw || undefined };
        }).filter(a => a.valueText !== undefined || a.valueNumber !== undefined || (a.valueArray && a.valueArray.length > 0)),
      }),
    });
    const body = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(body.error || 'Submission failed.'); return; }
    setSubmitted(body.confirmationMessage || 'Thank you for your response!');
  }

  if (error && !survey) return <div className="min-h-screen flex items-center justify-center p-4"><p className="text-red-600 text-sm">{error}</p></div>;
  if (!survey) return <div className="min-h-screen flex items-center justify-center p-4"><p className="text-gray-400 text-sm">Loading…</p></div>;
  if (submitted) return <div className="min-h-screen flex items-center justify-center p-4"><div className="max-w-md text-center"><div className="text-4xl mb-3">✅</div><p className="text-lg font-semibold">{submitted}</p></div></div>;

  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-lg space-y-4 bg-white rounded-xl border p-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{survey.title}</h1>
          {survey.description && <p className="text-sm text-gray-500 mt-1">{survey.description}</p>}
        </div>

        <input type="email" placeholder="Your email (optional)" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded border p-2 text-sm" />

        {survey.questions.map(q => (
          <div key={q.id} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">{q.text}{q.required && <span className="text-red-500"> *</span>}</label>
            {CHOICE_TYPES.has(q.type) ? (
              <select required={q.required} value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} className="w-full rounded border p-2 text-sm">
                <option value="">Select…</option>
                {q.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : q.type === 'rating_scale' ? (
              <input required={q.required} type="number" min={q.ratingMin} max={q.ratingMax} value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} className="w-24 rounded border p-2 text-sm" />
            ) : q.type === 'long_text' ? (
              <textarea required={q.required} value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} className="w-full rounded border p-2 text-sm" rows={3} />
            ) : (
              <input required={q.required} type={q.type === 'email' ? 'email' : q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'} value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} className="w-full rounded border p-2 text-sm" />
            )}
          </div>
        ))}

        {survey.consentRequired && (
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
            {survey.consentText}
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
