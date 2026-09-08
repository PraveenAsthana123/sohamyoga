'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Customer Onboarding Wizard -- confirmed zero implementation before this
// (grep, 2026-09-01). Writes real data into the existing customer +
// health_profile tables at each step, not a throwaway wizard-only model.

const CLASS_STYLES = ['Hatha', 'Vinyasa', 'Ashtanga', 'Yin', 'Restorative', 'Power'];
const CLASS_TIMES = ['Early Morning', 'Morning', 'Afternoon', 'Evening'];
const FITNESS_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const CONDITIONS = ['hypertension', 'diabetes', 'asthma', 'arthritis', 'chronic_pain', 'anxiety'];

const STEPS = ['goals', 'schedule', 'health', 'notifications'] as const;
type Step = typeof STEPS[number];

export default function CustomerOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('goals');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [goalStatement, setGoalStatement] = useState('');
  const [classStyles, setClassStyles] = useState<string[]>([]);
  const [classTimes, setClassTimes] = useState<string[]>([]);
  const [fitnessLevel, setFitnessLevel] = useState('moderate');
  const [conditions, setConditions] = useState<string[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [emailOptIn, setEmailOptIn] = useState(true);

  useEffect(() => {
    fetch('/api/customer/onboarding').then(r => r.json()).then(d => {
      if (d.onboarding_completed_at) { router.replace('/customer/dashboard'); return; }
      if (d.onboarding_step && STEPS.includes(d.onboarding_step)) setStep(d.onboarding_step);
      setGoalStatement(d.goal_statement ?? '');
      setClassStyles(d.preferred_class_styles ?? []);
      setClassTimes(d.preferred_class_times ?? []);
      setLoading(false);
    });
  }, [router]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);

  const next = async (body: Record<string, unknown>) => {
    setSaving(true);
    const res = await fetch('/api/customer/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, ...body }),
    });
    setSaving(false);
    if (!res.ok) return;
    const idx = STEPS.indexOf(step);
    if (idx === STEPS.length - 1) { router.replace('/customer/dashboard'); return; }
    setStep(STEPS[idx + 1]);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Loading…</p></div>;

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border p-8">
        <div className="flex gap-1 mb-6">
          {STEPS.map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-teal-600' : 'bg-gray-200'}`} />)}
        </div>

        {step === 'goals' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-1">What brings you to your mat?</h1>
            <p className="text-sm text-gray-500 mb-4">Tell us your practice goal — we'll personalize your plan around it.</p>
            <textarea value={goalStatement} onChange={e => setGoalStatement(e.target.value)} rows={3}
              placeholder="e.g. Reduce stress, build flexibility, prepare for a marathon…"
              className="w-full border rounded-lg p-3 text-sm mb-4" />
            <button onClick={() => next({ goalStatement })} disabled={saving} className="w-full bg-teal-600 text-white font-medium py-2.5 rounded-lg disabled:opacity-50">Continue</button>
          </>
        )}

        {step === 'schedule' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Your preferred practice</h1>
            <p className="text-sm text-gray-500 mb-4">Pick the styles and times that fit your life — you can change these anytime.</p>
            <p className="text-xs font-medium text-gray-600 mb-2">Class styles</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {CLASS_STYLES.map(s => (
                <button key={s} onClick={() => toggle(classStyles, setClassStyles, s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${classStyles.includes(s) ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600'}`}>{s}</button>
              ))}
            </div>
            <p className="text-xs font-medium text-gray-600 mb-2">Preferred times</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {CLASS_TIMES.map(t => (
                <button key={t} onClick={() => toggle(classTimes, setClassTimes, t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${classTimes.includes(t) ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600'}`}>{t}</button>
              ))}
            </div>
            <button onClick={() => next({ preferredClassStyles: classStyles, preferredClassTimes: classTimes })} disabled={saving} className="w-full bg-teal-600 text-white font-medium py-2.5 rounded-lg disabled:opacity-50">Continue</button>
          </>
        )}

        {step === 'health' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-1">A little about your body</h1>
            <p className="text-sm text-gray-500 mb-4">Helps instructors keep you safe. Never shared publicly.</p>
            <p className="text-xs font-medium text-gray-600 mb-2">Current fitness level</p>
            <select value={fitnessLevel} onChange={e => setFitnessLevel(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm mb-4">
              {FITNESS_LEVELS.map(f => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
            </select>
            <p className="text-xs font-medium text-gray-600 mb-2">Any conditions we should know about? (optional)</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {CONDITIONS.map(c => (
                <button key={c} onClick={() => toggle(conditions, setConditions, c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${conditions.includes(c) ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-300 text-gray-600'}`}>{c.replace('_', ' ')}</button>
              ))}
            </div>
            <button onClick={() => next({ fitnessLevel, conditions })} disabled={saving} className="w-full bg-teal-600 text-white font-medium py-2.5 rounded-lg disabled:opacity-50">Continue</button>
          </>
        )}

        {step === 'notifications' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Stay in the loop</h1>
            <p className="text-sm text-gray-500 mb-4">When should we remind you about upcoming classes?</p>
            <select value={reminderMinutes} onChange={e => setReminderMinutes(Number(e.target.value))} className="w-full border rounded-lg p-2.5 text-sm mb-4">
              {[15, 30, 60, 120].map(m => <option key={m} value={m}>{m} minutes before</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
              <input type="checkbox" checked={emailOptIn} onChange={e => setEmailOptIn(e.target.checked)} />
              Email me class reminders and studio news
            </label>
            <button onClick={() => next({ reminderMinutesBefore: reminderMinutes, emailOptIn })} disabled={saving} className="w-full bg-teal-600 text-white font-medium py-2.5 rounded-lg disabled:opacity-50">
              {saving ? 'Finishing…' : 'Finish Setup'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
