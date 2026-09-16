'use client';
// /customer/plan — read-only view of your real teacher/AI-assigned
// personalized_plan + plan_pose sequence.

import { useEffect, useState } from 'react';

interface Pose { sequence_no: number; hold_seconds: number; cue: string | null; sanskrit_name: string; english_name: string; difficulty_level: string }
interface Plan { id: string; name: string; description: string | null; focus_areas: string[]; weekly_sessions: number; session_minutes: number; difficulty: string; is_ai_generated: boolean; poses: Pose[] }

export default function PlanPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [hasStudentRecord, setHasStudentRecord] = useState(true);

  useEffect(() => {
    fetch('/api/customer/plan', { cache: 'no-store' }).then(r => r.json()).then(d => { setPlans(d.plans ?? []); setHasStudentRecord(d.hasStudentRecord); });
  }, []);

  if (!hasStudentRecord) return <p className="text-sm text-white/60">A personalized plan is available once your teacher creates one for you.</p>;
  if (!plans) return <p className="text-sm text-white/50">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold text-white">My Plan</h1>
        <p className="mt-1 text-sm text-white/60">Your personalized practice plan, set by your teacher.</p>
      </div>
      {plans.map(plan => (
        <div key={plan.id} className="rounded-xl border border-white/20 bg-slate-800/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">{plan.name}</h2>
            <div className="flex items-center gap-2">
              {plan.is_ai_generated && <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">AI-assisted</span>}
              <a href={`/api/customer/plan/docx?id=${plan.id}`} className="rounded border border-white/30 px-2 py-1 text-xs font-medium text-white/80 hover:bg-white/5">⬇ Word</a>
            </div>
          </div>
          {plan.description && <p className="mt-1 text-sm text-white/70">{plan.description}</p>}
          <p className="mt-1 text-xs text-white/60">{plan.weekly_sessions}x/week · {plan.session_minutes}m · {plan.difficulty}{plan.focus_areas?.length ? ` · ${plan.focus_areas.join(', ')}` : ''}</p>
          <div className="mt-3 space-y-2 text-white">
            {plan.poses.map(p => (
              <div key={p.sequence_no} className="flex items-center justify-between rounded border border-dashed p-2 text-sm">
                <span>{p.sequence_no}. {p.english_name} <span className="text-white/50">({p.sanskrit_name})</span></span>
                <span className="text-xs text-white/60">{p.hold_seconds}s</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!plans.length && <p className="text-sm text-white/50">No active plan yet.</p>}
    </div>
  );
}
