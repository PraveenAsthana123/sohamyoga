'use client';
// Real Create Survey Screen + Survey Question Builder -- survey/
// survey_question/survey_question_option had a rich real schema
// (single_choice/rating_scale/nps/etc, 14 real question types) but was
// only ever populated by seed SQL. First real create path.

import { useEffect, useState } from 'react';

interface SurveyRow { id: string; slug: string; title: string; status: string }
interface QuestionDraft { type: string; text: string; isRequired: boolean; options: string; ratingMin: string; ratingMax: string }

const QUESTION_TYPES = [
  'single_choice', 'multiple_choice', 'checkbox', 'rating_scale', 'short_text', 'long_text',
  'date', 'number', 'email', 'phone', 'nps',
];
const CHOICE_TYPES = new Set(['single_choice', 'multiple_choice', 'checkbox']);

const emptyQuestion = (): QuestionDraft => ({ type: 'short_text', text: '', isRequired: false, options: '', ratingMin: '1', ratingMax: '5' });

export default function SurveysAdminPage() {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [error, setError] = useState('');

  const load = () => { fetch('/api/admin/market-research/surveys', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setSurveys(d?.surveys ?? [])); };
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/market-research/surveys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, description, type: 'survey',
        questions: questions.map(q => ({
          type: q.type, text: q.text, isRequired: q.isRequired,
          options: CHOICE_TYPES.has(q.type) ? q.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
          ratingMin: q.type === 'rating_scale' ? Number(q.ratingMin) : undefined,
          ratingMax: q.type === 'rating_scale' ? Number(q.ratingMax) : undefined,
        })),
      }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error || 'Failed to create survey.'); return; }
    setShowNew(false); setTitle(''); setDescription(''); setQuestions([emptyQuestion()]);
    load();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real multi-question surveys, distinct from single-question NPS/polls.</p>
        </div>
        <button onClick={() => setShowNew(o => !o)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium">{showNew ? 'Cancel' : '+ New Survey'}</button>
      </div>

      {showNew && (
        <form onSubmit={create} className="bg-white border rounded-lg p-4 space-y-3">
          <input required placeholder="Survey title" value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded border p-2 text-sm" />
          <input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded border p-2 text-sm" />

          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="flex gap-2">
                  <select value={q.type} onChange={e => setQuestions(qs => qs.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} className="rounded border p-1.5 text-xs">
                    {QUESTION_TYPES.map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
                  </select>
                  <input required placeholder="Question text" value={q.text} onChange={e => setQuestions(qs => qs.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} className="flex-1 rounded border p-1.5 text-sm" />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={q.isRequired} onChange={e => setQuestions(qs => qs.map((x, j) => j === i ? { ...x, isRequired: e.target.checked } : x))} /> required</label>
                  {questions.length > 1 && <button type="button" onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))} className="text-xs text-red-500">Remove</button>}
                </div>
                {CHOICE_TYPES.has(q.type) && (
                  <input placeholder="Options, comma-separated" value={q.options} onChange={e => setQuestions(qs => qs.map((x, j) => j === i ? { ...x, options: e.target.value } : x))} className="w-full rounded border p-1.5 text-xs" />
                )}
                {q.type === 'rating_scale' && (
                  <div className="flex gap-2 text-xs">
                    <input type="number" value={q.ratingMin} onChange={e => setQuestions(qs => qs.map((x, j) => j === i ? { ...x, ratingMin: e.target.value } : x))} className="w-16 rounded border p-1" />
                    <span>to</span>
                    <input type="number" value={q.ratingMax} onChange={e => setQuestions(qs => qs.map((x, j) => j === i ? { ...x, ratingMax: e.target.value } : x))} className="w-16 rounded border p-1" />
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setQuestions(qs => [...qs, emptyQuestion()])} className="text-xs text-indigo-600 font-medium">+ Add question</button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Create survey</button>
          </div>
        </form>
      )}

      <div className="grid gap-2">
        {surveys.map(s => (
          <SurveyRowItem key={s.id} survey={s} onChanged={load} />
        ))}
        {!surveys.length && <p className="text-sm text-gray-400 text-center py-8">No surveys yet.</p>}
      </div>
    </div>
  );
}

const NEXT_STATUS: Record<string, string[]> = {
  draft: ['active'], active: ['paused', 'closed'], paused: ['active', 'closed'], closed: ['archived'], archived: [],
};
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700', paused: 'bg-amber-100 text-amber-700',
  closed: 'bg-red-100 text-red-700', archived: 'bg-gray-100 text-gray-400',
};

function SurveyRowItem({ survey, onChanged }: { survey: SurveyRow; onChanged: () => void }) {
  const [copied, setCopied] = useState(false);
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/surveys/${survey.slug}` : `/surveys/${survey.slug}`;

  async function transition(status: string) {
    await fetch(`/api/admin/market-research/surveys/${survey.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    onChanged();
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-white border rounded-lg p-3 text-sm space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-medium">{survey.title}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[survey.status] ?? 'bg-gray-100'}`}>{survey.status}</span>
      </div>
      <div className="flex items-center justify-between">
        {survey.status === 'active' ? (
          <button onClick={copyLink} className="text-xs text-indigo-600 hover:underline">{copied ? 'Copied!' : `${publicUrl}`}</button>
        ) : <span className="text-xs text-gray-400">Activate to get a public link.</span>}
        <div className="flex gap-2">
          {(NEXT_STATUS[survey.status] ?? []).map(s => (
            <button key={s} onClick={() => transition(s)} className="text-xs text-blue-600 hover:underline">{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
