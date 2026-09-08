'use client';
// Real teacher/admin authoring for personalized_plan + plan_pose. Previously
// this table had zero write surface anywhere in the app -- every customer's
// /customer/plan page showed "No active plan yet" permanently (found live
// during the 2026-09-01 admin-panel gap audit). This closes that gap.

import { useEffect, useState } from 'react';

interface Student { id: string; display_name: string; email: string }
interface Plan {
  id: string; student_id: string; student_name: string; name: string; description: string | null;
  focus_areas: string[]; weekly_sessions: number; session_minutes: number; difficulty: string;
  is_ai_generated: boolean; is_active: boolean; pose_count: number; created_at: string;
}
interface Asana { id: string; sanskrit_name: string; english_name: string; difficulty_level: string }
interface PlanPose { plan_id: string; asana_id: string; sequence_no: number; hold_seconds: number; cue: string | null; sanskrit_name: string; english_name: string }

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [asanas, setAsanas] = useState<Asana[]>([]);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [poses, setPoses] = useState<PlanPose[]>([]);
  const [form, setForm] = useState({ studentId: '', name: '', description: '', weeklySessions: 3, sessionMinutes: 60, difficulty: 'beginner' });
  const [poseForm, setPoseForm] = useState({ asanaId: '', sequenceNo: 1, holdSeconds: 30, cue: '' });

  const loadPlans = () => fetch('/api/admin/plans', { cache: 'no-store' }).then(r => r.json()).then(d => setPlans(d.plans ?? []));
  useEffect(() => {
    loadPlans();
    fetch('/api/admin/students', { cache: 'no-store' }).then(r => r.json()).then(d => setStudents(d.students ?? []));
    fetch('/api/admin/asanas', { cache: 'no-store' }).then(r => r.json()).then(d => setAsanas(d.asanas ?? []));
  }, []);

  const loadPoses = (planId: string) => fetch(`/api/admin/plans/${planId}/poses`, { cache: 'no-store' }).then(r => r.json()).then(d => setPoses(d.poses ?? []));
  useEffect(() => { if (selectedPlan) loadPoses(selectedPlan); }, [selectedPlan]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/plans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, focusAreas: [] }),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    setForm({ studentId: '', name: '', description: '', weeklySessions: 3, sessionMinutes: 60, difficulty: 'beginner' });
    loadPlans();
  }

  async function addPose(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan) return;
    setError('');
    const res = await fetch(`/api/admin/plans/${selectedPlan}/poses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(poseForm),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    setPoseForm({ asanaId: '', sequenceNo: poses.length + 2, holdSeconds: 30, cue: '' });
    loadPoses(selectedPlan);
    loadPlans();
  }

  async function removePose(asanaId: string) {
    if (!selectedPlan) return;
    await fetch(`/api/admin/plans/${selectedPlan}/poses?asanaId=${asanaId}`, { method: 'DELETE' });
    loadPoses(selectedPlan);
    loadPlans();
  }

  async function toggleActive(plan: Plan) {
    await fetch('/api/admin/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: plan.id, isActive: !plan.is_active }) });
    loadPlans();
  }

  async function deletePlan(id: string) {
    await fetch(`/api/admin/plans?id=${id}`, { method: 'DELETE' });
    if (selectedPlan === id) setSelectedPlan(null);
    loadPlans();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Personalized Plans</h1>
        <p className="mt-1 text-sm text-gray-500">Assign a real practice plan + pose sequence to a student. Reflected live on their /customer/plan page.</p>
      </header>

      <form onSubmit={createPlan} className="app-card space-y-3">
        <h2 className="font-semibold text-gray-800">New plan</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <select required className="rounded border p-2 text-sm" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
            <option value="">Select student…</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.display_name} ({s.email})</option>)}
          </select>
          <input required placeholder="Plan name" className="rounded border p-2 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <textarea placeholder="Description" className="w-full rounded border p-2 text-sm" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          <input type="number" min={1} max={14} placeholder="Weekly sessions" className="rounded border p-2 text-sm" value={form.weeklySessions} onChange={e => setForm({ ...form, weeklySessions: Number(e.target.value) })} />
          <input type="number" min={10} max={180} placeholder="Session minutes" className="rounded border p-2 text-sm" value={form.sessionMinutes} onChange={e => setForm({ ...form, sessionMinutes: Number(e.target.value) })} />
          <select className="rounded border p-2 text-sm" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">Create plan</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="app-card">
          <h2 className="mb-3 font-semibold text-gray-800">All plans ({plans.length})</h2>
          <div className="space-y-2">
            {plans.map(p => (
              <div key={p.id} className={`cursor-pointer rounded-lg border p-3 text-sm ${selectedPlan === p.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`} onClick={() => setSelectedPlan(p.id)}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.is_active ? 'active' : 'inactive'}</span>
                </div>
                <p className="text-xs text-gray-500">{p.student_name} · {p.pose_count} poses · {p.difficulty}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={e => { e.stopPropagation(); toggleActive(p); }} className="text-xs text-blue-600 underline">{p.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button onClick={e => { e.stopPropagation(); deletePlan(p.id); }} className="text-xs text-red-600 underline">Delete</button>
                </div>
              </div>
            ))}
            {!plans.length && <p className="text-sm text-gray-400">No plans created yet.</p>}
          </div>
        </div>

        <div className="app-card">
          <h2 className="mb-3 font-semibold text-gray-800">Pose sequence {selectedPlan ? '' : '(select a plan)'}</h2>
          {selectedPlan && (
            <>
              <form onSubmit={addPose} className="mb-3 space-y-2 rounded border border-dashed p-3">
                <select required className="w-full rounded border p-2 text-sm" value={poseForm.asanaId} onChange={e => setPoseForm({ ...poseForm, asanaId: e.target.value })}>
                  <option value="">Select pose…</option>
                  {asanas.map(a => <option key={a.id} value={a.id}>{a.english_name} ({a.sanskrit_name})</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min={1} placeholder="Order #" className="rounded border p-2 text-sm" value={poseForm.sequenceNo} onChange={e => setPoseForm({ ...poseForm, sequenceNo: Number(e.target.value) })} />
                  <input type="number" min={5} placeholder="Hold (sec)" className="rounded border p-2 text-sm" value={poseForm.holdSeconds} onChange={e => setPoseForm({ ...poseForm, holdSeconds: Number(e.target.value) })} />
                </div>
                <input placeholder="Cue (optional)" className="w-full rounded border p-2 text-sm" value={poseForm.cue} onChange={e => setPoseForm({ ...poseForm, cue: e.target.value })} />
                <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">Add pose</button>
              </form>
              <div className="space-y-1">
                {poses.map(p => (
                  <div key={p.asana_id} className="flex items-center justify-between rounded border border-gray-100 p-2 text-sm">
                    <span>{p.sequence_no}. {p.english_name} <span className="text-gray-400">({p.hold_seconds}s)</span></span>
                    <button onClick={() => removePose(p.asana_id)} className="text-xs text-red-600 underline">Remove</button>
                  </div>
                ))}
                {!poses.length && <p className="text-sm text-gray-400">No poses added yet.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
