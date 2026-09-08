'use client';
// Video Course Management -- a real curriculum layer (Course -> Module ->
// Lesson) wrapping the existing real video_asset script/render pipeline.
// A lesson without a linked video is honestly shown as "not started", never
// silently hidden or faked as complete.

import { useEffect, useState, useCallback } from 'react';

interface CourseHealth { score: number; readyLessons: number; totalLessons: number }
interface CourseRow { id: string; title: string; description: string; status: string; createdAt: string; health: CourseHealth }
interface LessonRow { id: string; title: string; sortOrder: number; videoAssetId: string | null; videoTitle: string | null; scriptStatus: string | null; renderStatus: string | null }
interface ModuleRow { id: string; title: string; sortOrder: number; lessons: LessonRow[] }

const STATUS_COLOR: Record<string, string> = { draft: 'bg-gray-100 text-gray-600', published: 'bg-green-100 text-green-700', archived: 'bg-red-100 text-red-700' };
const NEXT_ACTIONS: Record<string, string[]> = { draft: ['published', 'archived'], published: ['archived'], archived: [] };

function NewCourseForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/admin/video-courses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setTitle(''); setDescription(''); onCreated(); }
    else setError(body.error ?? 'Failed to create course.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Course</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-md">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Course title" className="w-full border rounded px-2 py-1.5 text-sm" />
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" rows={2} className="w-full border rounded px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={busy || !title.trim()} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

function NewModuleForm({ courseId, onCreated }: { courseId: string; onCreated: () => void }) {
  const [title, setTitle] = useState(''); const [busy, setBusy] = useState(false);
  async function handleCreate() {
    setBusy(true);
    await fetch(`/api/admin/video-courses/${courseId}/modules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    });
    setBusy(false); setTitle(''); onCreated();
  }
  return (
    <div className="flex gap-2 mt-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="+ Module title" className="flex-1 border rounded px-2 py-1 text-xs" />
      <button onClick={handleCreate} disabled={busy || !title.trim()} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50">Add</button>
    </div>
  );
}

function NewLessonForm({ moduleId, onCreated }: { moduleId: string; onCreated: () => void }) {
  const [title, setTitle] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function handleCreate() {
    setBusy(true); setError('');
    const res = await fetch(`/api/admin/video-modules/${moduleId}/lessons`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    });
    setBusy(false);
    if (res.ok) { setTitle(''); onCreated(); } else setError('Failed to add lesson.');
  }
  return (
    <div className="flex gap-2 mt-1 ml-4">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="+ Lesson title" className="flex-1 border rounded px-2 py-1 text-xs" />
      <button onClick={handleCreate} disabled={busy || !title.trim()} className="text-xs px-2 py-1 bg-gray-50 rounded hover:bg-gray-100 disabled:opacity-50">Add</button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

function CourseCard({ course, onChanged }: { course: CourseRow; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);

  const loadModules = useCallback(() => {
    setLoadingModules(true);
    fetch(`/api/admin/video-courses/${course.id}/modules`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setModules(d?.modules ?? [])).finally(() => setLoadingModules(false));
  }, [course.id]);

  useEffect(() => { if (expanded) loadModules(); }, [expanded, loadModules]);

  async function transition(status: string) {
    await fetch(`/api/admin/video-courses/${course.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    onChanged();
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div>
          <button onClick={() => setExpanded(e => !e)} className="font-medium text-gray-800 hover:underline text-left">{expanded ? '▼' : '▶'} {course.title}</button>
          <p className="text-xs text-gray-400 mt-0.5">{course.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[course.status]}`}>{course.status}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
            Health: {course.health.score}/100 ({course.health.readyLessons}/{course.health.totalLessons} lessons ready)
          </span>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        {(NEXT_ACTIONS[course.status] ?? []).map(s => (
          <button key={s} onClick={() => transition(s)} className="text-xs text-blue-600 hover:underline">Mark {s}</button>
        ))}
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {loadingModules ? <p className="text-xs text-gray-400">Loading…</p> : modules.map(m => (
            <div key={m.id} className="border rounded p-2">
              <p className="text-sm font-medium text-gray-700">{m.title}</p>
              <div className="mt-1 space-y-1">
                {m.lessons.map(l => (
                  <div key={l.id} className="flex justify-between items-center text-xs bg-gray-50 rounded px-2 py-1 ml-4">
                    <span>{l.title}</span>
                    <span className={`px-1.5 py-0.5 rounded-full ${l.videoAssetId ? (l.renderStatus === 'complete' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700') : 'bg-gray-100 text-gray-500'}`}>
                      {l.videoAssetId ? `${l.scriptStatus ?? 'no script'} / ${l.renderStatus ?? 'no render'}` : 'not started'}
                    </span>
                  </div>
                ))}
                {!m.lessons.length && <p className="text-xs text-gray-400 ml-4">No lessons yet.</p>}
              </div>
              <NewLessonForm moduleId={m.id} onCreated={loadModules} />
            </div>
          ))}
          {!modules.length && !loadingModules && <p className="text-xs text-gray-400">No modules yet.</p>}
          <NewModuleForm courseId={course.id} onCreated={loadModules} />
        </div>
      )}
    </div>
  );
}

export default function VideoCoursesAdmin() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/video-courses', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setCourses(d?.courses ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video Courses</h1>
          <p className="text-sm text-gray-500">A real curriculum layer over the video script/render pipeline. Lessons without a linked video are honestly "not started."</p>
        </div>
        <NewCourseForm onCreated={load} />
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {courses.map(c => <CourseCard key={c.id} course={c} onChanged={load} />)}
          {!courses.length && <p className="text-sm text-gray-400">No courses yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}
