'use client';
// Real teacher assessment-entry for pose_assessment. Previously this table
// had zero write surface anywhere in the app (found live during the
// 2026-09-01 admin-panel gap audit) -- every customer's /customer/pose-
// mastery page was permanently empty. This closes that gap.

import { useEffect, useState } from 'react';

interface Student { id: string; display_name: string; email: string }
interface Asana { id: string; sanskrit_name: string; english_name: string }
interface Assessment {
  id: string; student_id: string; student_name: string; asana_id: string; english_name: string; sanskrit_name: string;
  mastery_level: string; teacher_notes: string | null; assessed_at: string;
}

const LEVELS = ['exploring', 'learning', 'practising', 'proficient', 'master'];
const LEVEL_COLOR: Record<string, string> = {
  exploring: 'bg-gray-100 text-gray-600', learning: 'bg-blue-100 text-blue-700', practising: 'bg-amber-100 text-amber-700',
  proficient: 'bg-green-100 text-green-700', master: 'bg-purple-100 text-purple-700',
};

export default function AdminPoseAssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [asanas, setAsanas] = useState<Asana[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ studentId: '', asanaId: '', masteryLevel: 'exploring', teacherNotes: '' });

  const load = () => fetch('/api/admin/pose-assessments', { cache: 'no-store' }).then(r => r.json()).then(d => setAssessments(d.assessments ?? []));
  useEffect(() => {
    load();
    fetch('/api/admin/students', { cache: 'no-store' }).then(r => r.json()).then(d => setStudents(d.students ?? []));
    fetch('/api/admin/asanas', { cache: 'no-store' }).then(r => r.json()).then(d => setAsanas(d.asanas ?? []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/pose-assessments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error); return; }
    setForm({ studentId: '', asanaId: '', masteryLevel: 'exploring', teacherNotes: '' });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/pose-assessments?id=${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Pose Mastery Assessments</h1>
        <p className="mt-1 text-sm text-gray-500">Record a real assessment. Reflected live on the student's /customer/pose-mastery page.</p>
      </header>

      <form onSubmit={submit} className="app-card space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <select required className="rounded border p-2 text-sm" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
            <option value="">Select student…</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.display_name} ({s.email})</option>)}
          </select>
          <select required className="rounded border p-2 text-sm" value={form.asanaId} onChange={e => setForm({ ...form, asanaId: e.target.value })}>
            <option value="">Select pose…</option>
            {asanas.map(a => <option key={a.id} value={a.id}>{a.english_name} ({a.sanskrit_name})</option>)}
          </select>
        </div>
        <select className="rounded border p-2 text-sm" value={form.masteryLevel} onChange={e => setForm({ ...form, masteryLevel: e.target.value })}>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <textarea placeholder="Teacher notes (optional)" className="w-full rounded border p-2 text-sm" value={form.teacherNotes} onChange={e => setForm({ ...form, teacherNotes: e.target.value })} />
        <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save assessment</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="app-card">
        <h2 className="mb-3 font-semibold text-gray-800">All assessments ({assessments.length})</h2>
        <div className="space-y-2">
          {assessments.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm">
              <div>
                <div className="font-medium">{a.student_name} · {a.english_name}</div>
                <div className="text-xs text-gray-500">{a.teacher_notes || '—'} · {new Date(a.assessed_at).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${LEVEL_COLOR[a.mastery_level]}`}>{a.mastery_level}</span>
                <button onClick={() => remove(a.id)} className="text-xs text-red-600 underline">Delete</button>
              </div>
            </div>
          ))}
          {!assessments.length && <p className="text-sm text-gray-400">No assessments recorded yet.</p>}
        </div>
      </div>
    </div>
  );
}
