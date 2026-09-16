'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  target_audience: string | null;
  learning_objectives: string[] | null;
  prerequisites: string[] | null;
  category: string | null;
  level: string;
  language: string;
  status: string;
  thumbnail_url: string | null;
  promo_video_url: string | null;
  price_cad: number | null;
  is_free: boolean;
  tags: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  enrollment_count: number;
  rating: number | null;
  total_duration_minutes: number;
  total_lessons: number;
  section_count: number;
  lesson_count: number;
  published_lessons: number;
  computed_duration: number;
  created_at: string;
}

interface Section {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  lessons?: Lesson[];
}

interface Lesson {
  id: string;
  section_id: string;
  course_id: string;
  title: string;
  lesson_type: string;
  duration_minutes: number | null;
  video_type: string;
  script_text: string | null;
  ai_script: string | null;
  hook_text: string | null;
  key_points: string[] | null;
  summary_text: string | null;
  captions_srt: string | null;
  tags: string[] | null;
  labels: string[] | null;
  sound_track: string | null;
  status: string;
  order_index: number;
  is_free_preview: boolean;
  notes: string | null;
}

interface Quiz {
  id: string;
  lesson_id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_PIPELINE = ['planning', 'scripting', 'recording', 'editing', 'review', 'published'];
const CATEGORY_COLORS: Record<string, string> = {
  yoga: 'bg-emerald-500',
  digital_marketing: 'bg-blue-500',
  wellness: 'bg-violet-500',
  business: 'bg-amber-500',
  tech: 'bg-cyan-500',
};
const LEVEL_BADGES: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-red-100 text-red-700',
};
const STATUS_BADGES: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-600',
  scripting: 'bg-blue-100 text-blue-700',
  recording: 'bg-orange-100 text-orange-700',
  editing: 'bg-purple-100 text-purple-700',
  review: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
};
const LESSON_STATUS_COLORS: Record<string, string> = {
  planned: 'bg-gray-300',
  scripted: 'bg-blue-400',
  recorded: 'bg-orange-400',
  edited: 'bg-purple-400',
  published: 'bg-green-500',
};
const TYPE_ICONS: Record<string, string> = {
  video: '🎥',
  audio: '🎙️',
  text: '📝',
  quiz: '❓',
  assignment: '📋',
  live: '🔴',
};
const DURATION_OPTIONS = [1, 2, 5, 10, 15, 20, 30, 45, 60];
const SOUND_TRACKS = ['Upbeat', 'Calm', 'Professional', 'Nature', 'Silent'];
const LABEL_OPTIONS = ['intro', 'theory', 'demo', 'exercise', 'summary', 'quiz'];
const CATEGORIES = ['yoga', 'digital_marketing', 'wellness', 'business', 'tech'];
const LESSON_TYPES = ['video', 'audio', 'text', 'quiz', 'assignment', 'live'];

function formatDuration(minutes: number): string {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-gray-400 text-xs">No ratings</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5 text-xs">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= full ? 'text-amber-400' : (i === full + 1 && half ? 'text-amber-300' : 'text-gray-300')}>★</span>
      ))}
      <span className="text-gray-600 ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

// ─── New Course Modal ─────────────────────────────────────────────────────────

function NewCourseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('yoga');
  const [level, setLevel] = useState('beginner');
  const [targetAudience, setTargetAudience] = useState('');
  const [objectives, setObjectives] = useState(['']);
  const [prereqs, setPrereqs] = useState(['']);
  const [priceCad, setPriceCad] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim()) { setError('Title is required'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/course-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, subtitle: subtitle || null, category, level,
          target_audience: targetAudience || null,
          learning_objectives: objectives.filter(Boolean),
          prerequisites: prereqs.filter(Boolean),
          price_cad: isFree ? null : (parseFloat(priceCad) || null),
          is_free: isFree,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed');
      onCreated();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">New Course</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Course Title *" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Subtitle" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Level</label>
                <select value={level} onChange={e => setLevel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {['beginner','intermediate','advanced'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="Target Audience" className="w-full border rounded-lg px-3 py-2 text-sm" />

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Learning Objectives</label>
              {objectives.map((o, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input value={o} onChange={e => { const n=[...objectives]; n[i]=e.target.value; setObjectives(n); }} placeholder={`Objective ${i+1}`} className="flex-1 border rounded px-2 py-1 text-sm" />
                  <button onClick={() => setObjectives(objectives.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 px-1">−</button>
                </div>
              ))}
              <button onClick={() => setObjectives([...objectives, ''])} className="text-xs text-indigo-600 hover:underline">+ Add objective</button>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prerequisites</label>
              {prereqs.map((p, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input value={p} onChange={e => { const n=[...prereqs]; n[i]=e.target.value; setPrereqs(n); }} placeholder={`Prerequisite ${i+1}`} className="flex-1 border rounded px-2 py-1 text-sm" />
                  <button onClick={() => setPrereqs(prereqs.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 px-1">−</button>
                </div>
              ))}
              <button onClick={() => setPrereqs([...prereqs, ''])} className="text-xs text-indigo-600 hover:underline">+ Add prerequisite</button>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} className="rounded" />
                Free course
              </label>
              {!isFree && (
                <input value={priceCad} onChange={e => setPriceCad(e.target.value)} placeholder="Price (CAD)" type="number" min="0" step="0.01" className="border rounded px-2 py-1 text-sm w-32" />
              )}
            </div>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags (comma-separated)" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={handleCreate} disabled={busy || !title.trim()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Creating...' : 'Create Course'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Courses ───────────────────────────────────────────────────────────

function CoursesTab({ courses, loading, onRefresh }: {
  courses: Course[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const totalLessons = courses.reduce((s, c) => s + (c.lesson_count ?? 0), 0);
  const totalHours = courses.reduce((s, c) => s + (c.computed_duration ?? c.total_duration_minutes ?? 0), 0) / 60;
  const published = courses.filter(c => c.status === 'published').length;
  const inProd = courses.filter(c => c.status !== 'published').length;
  const avgRating = courses.filter(c => c.rating).reduce((s, c, _, a) => s + (c.rating ?? 0) / a.length, 0);

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/admin/course-studio/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    onRefresh();
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Courses', value: courses.length, color: 'bg-indigo-50 text-indigo-700' },
          { label: 'Published', value: published, color: 'bg-green-50 text-green-700' },
          { label: 'In Production', value: inProd, color: 'bg-orange-50 text-orange-700' },
          { label: 'Total Lessons', value: totalLessons, color: 'bg-blue-50 text-blue-700' },
          { label: 'Hours of Content', value: totalHours.toFixed(1) + 'h', color: 'bg-purple-50 text-purple-700' },
          { label: 'Avg Rating', value: avgRating ? avgRating.toFixed(1) + '★' : 'N/A', color: 'bg-amber-50 text-amber-700' },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.color} rounded-xl p-4`}>
            <div className="text-2xl font-bold">{kpi.value}</div>
            <div className="text-xs mt-1 opacity-80">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">All Courses ({courses.length})</h2>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Course
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading courses...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => {
            const pct = course.lesson_count > 0
              ? Math.round((course.published_lessons / course.lesson_count) * 100)
              : 0;
            const catColor = CATEGORY_COLORS[course.category ?? ''] ?? 'bg-gray-400';
            return (
              <div key={course.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Thumbnail */}
                <div className={`${catColor} h-24 flex items-center justify-center`}>
                  <div className="text-white text-center">
                    <div className="text-3xl font-bold opacity-20">
                      {course.category?.split('_').map(w => w[0].toUpperCase()).join('') ?? '?'}
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{course.title}</h3>
                    <div className="flex gap-1 flex-shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LEVEL_BADGES[course.level] ?? 'bg-gray-100 text-gray-600'}`}>
                        {course.level}
                      </span>
                    </div>
                  </div>

                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGES[course.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {course.status}
                  </span>

                  {/* Status pipeline */}
                  <div className="flex gap-0.5">
                    {STATUS_PIPELINE.map((s, i) => (
                      <button
                        key={s}
                        title={s}
                        onClick={() => handleStatusChange(course.id, s)}
                        className={`flex-1 h-1.5 rounded-sm transition-colors ${
                          STATUS_PIPELINE.indexOf(course.status) >= i
                            ? (s === 'published' ? 'bg-green-500' : 'bg-indigo-400')
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{course.published_lessons}/{course.lesson_count} lessons published</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDuration(course.computed_duration || course.total_duration_minutes)}</span>
                    <span>{course.enrollment_count} enrolled</span>
                    <StarRating rating={course.rating} />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <a href={`/admin/course-studio/${course.id}`} className="flex-1 text-center px-2 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700">
                      Open Studio
                    </a>
                    {course.status !== 'published' && (
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/admin/course-studio/${course.id}/publish`, { method: 'POST' });
                          const d = await res.json();
                          if (!res.ok) alert('Cannot publish: ' + (d.errors ?? [d.error]).join('; '));
                          else { alert('Course published!'); onRefresh(); }
                        }}
                        className="px-2 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                      >
                        Publish
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <NewCourseModal onClose={() => setShowModal(false)} onCreated={onRefresh} />}
    </div>
  );
}

// ─── Tab 2: Lesson Builder ────────────────────────────────────────────────────

function LessonBuilder({ courses, onRefresh }: { courses: Course[]; onRefresh: () => void }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id ?? '');
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [addingLesson, setAddingLesson] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [lessonForm, setLessonForm] = useState<Partial<Lesson>>({});
  const [saving, setSaving] = useState(false);
  const [scriptGenerating, setScriptGenerating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadSections = useCallback(async (cid: string) => {
    if (!cid) return;
    const res = await fetch(`/api/admin/course-studio/${cid}`);
    if (!res.ok) return;
    const data = await res.json();
    setSections(data.sections ?? []);
    setExpanded(new Set((data.sections ?? []).map((s: Section) => s.id)));
  }, []);

  useEffect(() => {
    if (selectedCourseId) loadSections(selectedCourseId);
  }, [selectedCourseId, loadSections]);

  useEffect(() => {
    if (selectedLesson) setLessonForm({ ...selectedLesson });
  }, [selectedLesson]);

  async function addSection() {
    if (!newSectionTitle.trim()) return;
    await fetch(`/api/admin/course-studio/${selectedCourseId}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSectionTitle }),
    });
    setNewSectionTitle(''); setAddingSection(false);
    loadSections(selectedCourseId);
  }

  async function addLesson(sectionId: string) {
    if (!newLessonTitle.trim()) return;
    await fetch(`/api/admin/course-studio/${selectedCourseId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId, title: newLessonTitle, lesson_type: 'video', duration_minutes: 5 }),
    });
    setNewLessonTitle(''); setAddingLesson(null);
    loadSections(selectedCourseId);
  }

  async function saveLesson() {
    if (!selectedLesson) return;
    setSaving(true);
    await fetch(`/api/admin/course-studio/${selectedCourseId}/lessons/${selectedLesson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lessonForm),
    });
    setSaving(false);
    loadSections(selectedCourseId);
    onRefresh();
  }

  async function generateScript() {
    if (!selectedLesson) return;
    setScriptGenerating(true);
    try {
      const course = courses.find(c => c.id === selectedCourseId);
      const res = await fetch(`/api/admin/course-studio/${selectedCourseId}/lessons/${selectedLesson.id}/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: lessonForm.title ?? selectedLesson.title,
          duration_minutes: lessonForm.duration_minutes ?? 5,
          lesson_type: lessonForm.lesson_type ?? 'video',
          audience_level: course?.level ?? 'beginner',
          style: 'educational',
          include_hook: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLessonForm(prev => ({
          ...prev,
          ai_script: data.script,
          hook_text: data.hook_text,
          key_points: data.key_points,
        }));
      }
    } finally {
      setScriptGenerating(false);
    }
  }

  return (
    <div className="flex gap-6 h-[700px]">
      {/* Left: tree */}
      <div className="w-72 flex-shrink-0 border border-gray-200 rounded-xl overflow-y-auto bg-gray-50">
        <div className="p-3 border-b bg-white sticky top-0 z-10">
          <select
            value={selectedCourseId}
            onChange={e => { setSelectedCourseId(e.target.value); setSelectedLesson(null); }}
            className="w-full border rounded-lg px-2 py-1.5 text-sm"
          >
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        <div className="p-2 space-y-1">
          {sections.map(section => (
            <div key={section.id} className="rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(prev => {
                  const n = new Set(prev);
                  n.has(section.id) ? n.delete(section.id) : n.add(section.id);
                  return n;
                })}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span className="text-gray-400">{expanded.has(section.id) ? '▼' : '▶'}</span>
                <span className="flex-1 text-left truncate">{section.title}</span>
                <span className="text-xs text-gray-400">{section.lessons?.length ?? 0}</span>
              </button>

              {expanded.has(section.id) && (
                <div className="ml-3 mt-1 space-y-0.5">
                  {(section.lessons ?? []).map(lesson => (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLesson(lesson)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-left transition-colors ${
                        selectedLesson?.id === lesson.id
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${LESSON_STATUS_COLORS[lesson.status] ?? 'bg-gray-300'}`} />
                      <span className="flex-1 truncate">{lesson.title}</span>
                      <span className="flex-shrink-0">{TYPE_ICONS[lesson.lesson_type] ?? '📄'}</span>
                      {lesson.duration_minutes && <span className="text-gray-400 flex-shrink-0">{lesson.duration_minutes}m</span>}
                    </button>
                  ))}

                  {addingLesson === section.id ? (
                    <div className="flex gap-1 px-1">
                      <input
                        autoFocus
                        value={newLessonTitle}
                        onChange={e => setNewLessonTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addLesson(section.id); if (e.key === 'Escape') setAddingLesson(null); }}
                        placeholder="Lesson title"
                        className="flex-1 border rounded px-2 py-1 text-xs"
                      />
                      <button onClick={() => addLesson(section.id)} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded">✓</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingLesson(section.id)}
                      className="w-full text-left px-3 py-1 text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      + Add Lesson
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {addingSection ? (
            <div className="flex gap-1 p-1">
              <input
                autoFocus
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') setAddingSection(false); }}
                placeholder="Section title"
                className="flex-1 border rounded px-2 py-1 text-xs"
              />
              <button onClick={addSection} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded">✓</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSection(true)}
              className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Add Section
            </button>
          )}
        </div>
      </div>

      {/* Right: lesson editor */}
      <div className="flex-1 border border-gray-200 rounded-xl overflow-y-auto">
        {!selectedLesson ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-3">🎬</div>
              <div>Select a lesson to edit</div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Lesson Editor</h3>
              <button onClick={saveLesson} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-700 mb-1 block">Title</label>
                <input value={lessonForm.title ?? ''} onChange={e => setLessonForm(p => ({...p, title: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Type</label>
                <select value={lessonForm.lesson_type ?? 'video'} onChange={e => setLessonForm(p => ({...p, lesson_type: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {LESSON_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Duration</label>
                <select value={lessonForm.duration_minutes ?? ''} onChange={e => {
                  const m = parseInt(e.target.value);
                  const vt = m <= 5 ? 'short' : m <= 20 ? 'medium' : 'long';
                  setLessonForm(p => ({...p, duration_minutes: m, video_type: vt}));
                }} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select duration</option>
                  {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                <select value={lessonForm.status ?? 'planned'} onChange={e => setLessonForm(p => ({...p, status: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {['planned','scripted','recorded','edited','published'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Sound Track</label>
                <select value={lessonForm.sound_track ?? ''} onChange={e => setLessonForm(p => ({...p, sound_track: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">None</option>
                  {SOUND_TRACKS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Video Type */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Video Type</label>
              <div className="flex gap-2">
                {[['short','Short (1–5 min)'],['medium','Medium (5–20 min)'],['long','Long (20+ min)']].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setLessonForm(p => ({...p, video_type: v}))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${lessonForm.video_type === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Labels */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Labels</label>
              <div className="flex flex-wrap gap-2">
                {LABEL_OPTIONS.map(label => {
                  const active = (lessonForm.labels ?? []).includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        const cur = lessonForm.labels ?? [];
                        setLessonForm(p => ({...p, labels: active ? cur.filter(l => l !== label) : [...cur, label]}));
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hook */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Hook (First 30 seconds)</label>
              <textarea value={lessonForm.hook_text ?? ''} onChange={e => setLessonForm(p => ({...p, hook_text: e.target.value}))} rows={2} placeholder="Attention-grabbing opening — what's the hook that keeps viewers watching?" className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
            </div>

            {/* Key Points */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">Key Points</label>
              {(lessonForm.key_points ?? []).map((kp, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input value={kp} onChange={e => {
                    const n = [...(lessonForm.key_points ?? [])]; n[i] = e.target.value;
                    setLessonForm(p => ({...p, key_points: n}));
                  }} className="flex-1 border rounded px-2 py-1 text-sm" placeholder={`Key point ${i+1}`} />
                  <button onClick={() => setLessonForm(p => ({...p, key_points: (p.key_points ?? []).filter((_, j) => j !== i)}))} className="text-red-400">−</button>
                </div>
              ))}
              <button onClick={() => setLessonForm(p => ({...p, key_points: [...(p.key_points ?? []), '']}))} className="text-xs text-indigo-600 hover:underline">+ Add key point</button>
            </div>

            {/* Script */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">Script</label>
                <button onClick={generateScript} disabled={scriptGenerating} className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
                  {scriptGenerating ? 'Generating...' : '✨ AI Generate'}
                </button>
              </div>
              <textarea
                value={lessonForm.ai_script ?? lessonForm.script_text ?? ''}
                onChange={e => setLessonForm(p => ({...p, ai_script: e.target.value}))}
                rows={8}
                placeholder="Full lesson script..."
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono resize-y"
              />
              {(lessonForm.ai_script || lessonForm.script_text) && (
                <div className="text-xs text-gray-400 mt-1">
                  {((lessonForm.ai_script ?? lessonForm.script_text ?? '').split(/\s+/).filter(Boolean).length)} words
                </div>
              )}
            </div>

            {/* Free Preview toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setLessonForm(p => ({...p, is_free_preview: !p.is_free_preview}))}
                className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${lessonForm.is_free_preview ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-transform ${lessonForm.is_free_preview ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm text-gray-700">Free Preview</span>
            </label>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={lessonForm.notes ?? ''} onChange={e => setLessonForm(p => ({...p, notes: e.target.value}))} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 3: AI Script Generator ───────────────────────────────────────────────

function ScriptGeneratorTab({ courses }: { courses: Course[] }) {
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(5);
  const [lessonType, setLessonType] = useState('Video Tutorial');
  const [style, setStyle] = useState('Educational');
  const [audienceLevel, setAudienceLevel] = useState('Beginner');
  const [includeHook, setIncludeHook] = useState(true);
  const [includeQuiz, setIncludeQuiz] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ script: string; hook_text: string; key_points: string[]; word_count: number; estimated_duration_minutes: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCourseId) { setLessons([]); return; }
    fetch(`/api/admin/course-studio/${selectedCourseId}/lessons`)
      .then(r => r.json())
      .then(d => setLessons(d.lessons ?? []));
  }, [selectedCourseId]);

  async function generate(variation = false) {
    setGenerating(true); setResult(null); setSaveMsg(null);
    try {
      const endpoint = selectedCourseId && selectedLessonId
        ? `/api/admin/course-studio/${selectedCourseId}/lessons/${selectedLessonId}/script`
        : `/api/admin/course-studio/generate-script`;

      // For quick generate without lesson, use the first available course/lesson or a stub
      let url = endpoint;
      let courseId = selectedCourseId;
      let lessonId = selectedLessonId;

      if (!courseId && courses.length) {
        const r = await fetch(`/api/admin/course-studio/${courses[0].id}/lessons`);
        const d = await r.json();
        if (d.lessons?.length) {
          courseId = courses[0].id;
          lessonId = d.lessons[0].id;
        }
      }

      if (!courseId || !lessonId) {
        alert('Please select a course and lesson, or create one first.');
        setGenerating(false);
        return;
      }

      url = `/api/admin/course-studio/${courseId}/lessons/${lessonId}/script`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || 'Lesson Topic',
          duration_minutes: duration,
          lesson_type: lessonType.toLowerCase().replace(' ', '_'),
          audience_level: audienceLevel.toLowerCase(),
          style: style.toLowerCase(),
          include_hook: includeHook,
          additional_context: additionalContext + (variation ? ' (generate a different variation with a fresh angle)' : ''),
        }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else alert(data.error ?? 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  function formatScript(script: string): string {
    return script
      .replace(/\[HOOK[^\]]*\]/gi, '🎣 HOOK')
      .replace(/\[INTRO[^\]]*\]/gi, '📖 INTRO')
      .replace(/\[MAIN CONTENT\]/gi, '📚 MAIN CONTENT')
      .replace(/\[SECTION (\d+)[^\]]*\]/gi, '▶ SECTION $1')
      .replace(/\[SUMMARY\]/gi, '✅ SUMMARY')
      .replace(/\[CTA\]|\[CALL TO ACTION\]/gi, '📣 CALL TO ACTION');
  }

  async function saveToLesson() {
    if (!result || !selectedCourseId || !selectedLessonId) return;
    await fetch(`/api/admin/course-studio/${selectedCourseId}/lessons/${selectedLessonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_script: result.script, hook_text: result.hook_text, key_points: result.key_points }),
    });
    setSaveMsg('Saved to lesson!');
    setTimeout(() => setSaveMsg(null), 3000);
  }

  return (
    <div className="grid grid-cols-2 gap-6 h-[700px]">
      {/* Left: form */}
      <div className="border border-gray-200 rounded-xl p-5 overflow-y-auto space-y-4">
        <h3 className="font-semibold text-gray-900">Script Generator</h3>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Course (optional)</label>
          <select value={selectedCourseId} onChange={e => { setSelectedCourseId(e.target.value); setSelectedLessonId(''); }} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">— Quick Generate —</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        {selectedCourseId && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Lesson</label>
            <select value={selectedLessonId} onChange={e => setSelectedLessonId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">— Select Lesson —</option>
              {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Topic / Title</label>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Warrior II Pose alignment cues" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-2 block">Duration</label>
          <div className="flex flex-wrap gap-2">
            {[1,2,5,10,20,30].map(d => (
              <button key={d} onClick={() => setDuration(d)} className={`px-3 py-1 rounded-lg text-xs font-medium border ${duration === d ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Lesson Type</label>
          <select value={lessonType} onChange={e => setLessonType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            {['Video Tutorial','How-To Demo','Educational Talk','Motivational','Product Showcase','Behind the Scenes','Live Lesson'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Style</label>
            <select value={style} onChange={e => setStyle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {['Educational','Conversational','Motivational','Demonstrative','Storytelling'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Audience Level</label>
            <select value={audienceLevel} onChange={e => setAudienceLevel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {['Beginner','Intermediate','Advanced'].map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeHook} onChange={e => setIncludeHook(e.target.checked)} className="rounded" />
            Include Hook
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeQuiz} onChange={e => setIncludeQuiz(e.target.checked)} className="rounded" />
            Include Quiz
          </label>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Additional Context</label>
          <textarea value={additionalContext} onChange={e => setAdditionalContext(e.target.value)} rows={3} placeholder="Any specific details, examples, or focus areas..." className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>

        <button onClick={() => generate()} disabled={generating} className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50">
          {generating ? '✨ Generating Script...' : '✨ Generate Script'}
        </button>
      </div>

      {/* Right: output */}
      <div className="border border-gray-200 rounded-xl p-5 overflow-y-auto flex flex-col gap-4">
        <h3 className="font-semibold text-gray-900">Generated Script</h3>

        {!result && !generating && (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📜</div>
              <div>Your generated script will appear here</div>
            </div>
          </div>
        )}

        {generating && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-purple-600">
              <div className="text-3xl mb-2 animate-pulse">✨</div>
              <div className="text-sm">Generating {duration}-minute script...</div>
            </div>
          </div>
        )}

        {result && (
          <>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="bg-gray-100 px-2 py-1 rounded">{result.word_count} words</span>
              <span className="bg-gray-100 px-2 py-1 rounded">~{result.estimated_duration_minutes} min</span>
            </div>

            {result.key_points?.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-blue-700 mb-2">Key Points</div>
                {result.key_points.map((kp, i) => (
                  <div key={i} className="text-xs text-blue-600 flex gap-1">
                    <span>•</span><span>{kp}</span>
                  </div>
                ))}
              </div>
            )}

            <pre className="flex-1 bg-gray-50 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap overflow-y-auto border border-gray-200 leading-relaxed">
              {formatScript(result.script)}
            </pre>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { navigator.clipboard.writeText(result.script); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
              >
                {copied ? '✓ Copied' : 'Copy All'}
              </button>
              <button onClick={saveToLesson} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                Save to Lesson
              </button>
              <button onClick={() => generate()} disabled={generating} className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50">
                Regenerate
              </button>
              <button onClick={() => generate(true)} disabled={generating} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50">
                Generate Variation
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('elevenlabs_script', result.script);
                  window.location.href = '/admin/elevenlabs';
                }}
                className="px-3 py-1.5 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
              >
                🎙️ Generate Voiceover
              </button>
            </div>
            {saveMsg && <div className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded">{saveMsg}</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab 4: Production Tracker ────────────────────────────────────────────────

function ProductionTracker({ courses }: { courses: Course[] }) {
  const [allLessons, setAllLessons] = useState<(Lesson & { course_title: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const all: (Lesson & { course_title: string })[] = [];
      for (const course of courses) {
        const res = await fetch(`/api/admin/course-studio/${course.id}/lessons`);
        if (!res.ok) continue;
        const data = await res.json();
        for (const lesson of data.lessons ?? []) {
          all.push({ ...lesson, course_title: course.title });
        }
      }
      setAllLessons(all);
      setLoading(false);
    }
    if (courses.length) load();
  }, [courses]);

  const statuses = ['planned', 'scripted', 'recorded', 'edited', 'review', 'published'] as const;

  async function moveLesson(lessonId: string, courseId: string, newStatus: string) {
    setMovingId(lessonId);
    await fetch(`/api/admin/course-studio/${courseId}/lessons/${lessonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setAllLessons(prev => prev.map(l => l.id === lessonId ? { ...l, status: newStatus } : l));
    setMovingId(null);
  }

  const byStatus = (s: string) => allLessons.filter(l => l.status === s);

  // Summary table
  const summaryRows = courses.map(course => {
    const cLessons = allLessons.filter(l => l.course_id === course.id);
    const counts = statuses.reduce((acc, s) => ({ ...acc, [s]: cLessons.filter(l => l.status === s).length }), {} as Record<string, number>);
    const pct = cLessons.length > 0 ? Math.round((counts.published / cLessons.length) * 100) : 0;
    return { ...counts, course_title: course.title, total: cLessons.length, pct };
  });

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading lessons...</div>
      ) : (
        <>
          {/* Kanban */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {statuses.map(status => {
              const lessons = byStatus(status);
              const colColor = LESSON_STATUS_COLORS[status] ?? 'bg-gray-300';
              return (
                <div key={status} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${colColor}`} />
                    <span className="text-xs font-semibold text-gray-700 capitalize">{status}</span>
                    <span className="ml-auto bg-white text-gray-600 text-xs px-1.5 py-0.5 rounded-full border">{lessons.length}</span>
                  </div>
                  <div className="space-y-2">
                    {lessons.map(lesson => (
                      <div
                        key={lesson.id}
                        className={`bg-white border border-gray-200 rounded-lg p-2.5 cursor-pointer hover:border-indigo-300 transition-colors ${movingId === lesson.id ? 'opacity-50' : ''}`}
                      >
                        <div className="text-xs text-gray-400 mb-0.5 truncate">{lesson.course_title}</div>
                        <div className="text-xs font-medium text-gray-800 leading-tight mb-1 line-clamp-2">{lesson.title}</div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs">{TYPE_ICONS[lesson.lesson_type]}</span>
                          {lesson.duration_minutes && <span className="text-xs text-gray-400">{lesson.duration_minutes}m</span>}
                        </div>
                        {/* Move buttons */}
                        <div className="flex gap-1 mt-2">
                          {status !== 'planned' && (
                            <button
                              onClick={() => {
                                const prev = statuses[statuses.indexOf(status) - 1];
                                if (prev) moveLesson(lesson.id, lesson.course_id, prev);
                              }}
                              className="flex-1 text-xs py-0.5 bg-gray-100 rounded hover:bg-gray-200"
                            >←</button>
                          )}
                          {status !== 'published' && (
                            <button
                              onClick={() => {
                                const next = statuses[statuses.indexOf(status) + 1];
                                if (next) moveLesson(lesson.id, lesson.course_id, next);
                              }}
                              className="flex-1 text-xs py-0.5 bg-indigo-100 rounded hover:bg-indigo-200 text-indigo-700"
                            >→</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Course</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">Total</th>
                  {statuses.map(s => <th key={s} className="text-center px-2 py-3 text-xs font-semibold text-gray-500 capitalize">{s}</th>)}
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-600">% Done</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.course_title}</td>
                    <td className="px-3 py-3 text-center text-sm text-gray-700">{row.total}</td>
                    {statuses.map(s => (
                      <td key={s} className="px-2 py-3 text-center text-sm text-gray-600">{(row as Record<string, number | string>)[s] ?? 0}</td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.pct === 100 ? 'bg-green-100 text-green-700' : row.pct > 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                        {row.pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab 5: Sound & Text ──────────────────────────────────────────────────────

const MUSIC_TRACKS = [
  { name: 'Upbeat Energy', genre: 'Pop', bpm: 128, mood: ['energetic','motivational','workout'] },
  { name: 'Calm Mindfulness', genre: 'Ambient', bpm: 60, mood: ['peaceful','meditation','focus'] },
  { name: 'Professional Corporate', genre: 'Corporate', bpm: 90, mood: ['professional','business','clean'] },
  { name: 'Nature Sounds', genre: 'Nature', bpm: 0, mood: ['relaxing','outdoor','organic'] },
  { name: 'Silent', genre: 'None', bpm: 0, mood: ['voiceover-only','focus'] },
];

function WaveformSVG({ color = '#6366f1', playing = false }: { color?: string; playing?: boolean }) {
  const points = [0.5,0.8,0.4,1.0,0.3,0.9,0.6,0.7,0.2,0.8,0.5,0.6,0.9,0.4,0.7,0.5,0.3,0.8,0.6,0.5];
  const path = points.map((y, i) => `${i === 0 ? 'M' : 'L'} ${(i / (points.length - 1)) * 100} ${50 - y * 30}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" className={`h-8 w-full ${playing ? 'animate-pulse' : ''}`}>
      <path d={path} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function SoundAndTextTab({ courses }: { courses: Course[] }) {
  const [trackVolumes, setTrackVolumes] = useState<number[]>(MUSIC_TRACKS.map(() => 70));
  const [playingTrack, setPlayingTrack] = useState<number | null>(null);
  const [overlayStyles] = useState([
    { name: 'Lower Third', position: 'bottom', fontSize: 18, color: '#ffffff', bg: '#0f172a' },
    { name: 'Title Card', position: 'middle', fontSize: 28, color: '#ffffff', bg: '#1e40af' },
    { name: 'Callout Box', position: 'top', fontSize: 16, color: '#1e293b', bg: '#fbbf24' },
  ]);
  const [selectedOverlay, setSelectedOverlay] = useState(0);
  const [previewText, setPreviewText] = useState('Your text here');
  const [captionLesson, setCaptionLesson] = useState('');
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [srtContent, setSrtContent] = useState('');

  useEffect(() => {
    async function loadLessons() {
      const all: Lesson[] = [];
      for (const course of courses) {
        const res = await fetch(`/api/admin/course-studio/${course.id}/lessons`);
        if (!res.ok) continue;
        const d = await res.json();
        all.push(...(d.lessons ?? []));
      }
      setAllLessons(all);
    }
    if (courses.length) loadLessons();
  }, [courses]);

  function previewPlay(i: number) {
    setPlayingTrack(i);
    setTimeout(() => setPlayingTrack(null), 3000);
  }

  function generateSRT(lesson: Lesson): string {
    const text = lesson.ai_script ?? lesson.script_text ?? 'No script available for this lesson.';
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let idx = 1, wordIdx = 0;
    const wordsPerLine = 8;
    const secondsPerLine = 3;
    while (wordIdx < words.length) {
      const lineWords = words.slice(wordIdx, wordIdx + wordsPerLine).join(' ');
      const startSec = (idx - 1) * secondsPerLine;
      const endSec = idx * secondsPerLine;
      const fmt = (s: number) => {
        const h = Math.floor(s / 3600).toString().padStart(2,'0');
        const m = Math.floor((s % 3600) / 60).toString().padStart(2,'0');
        const sec = (s % 60).toString().padStart(2,'0');
        return `${h}:${m}:${sec},000`;
      };
      lines.push(`${idx}\n${fmt(startSec)} --> ${fmt(endSec)}\n${lineWords}`);
      wordIdx += wordsPerLine;
      idx++;
    }
    return lines.join('\n\n');
  }

  const overlay = overlayStyles[selectedOverlay];
  const posStyle = overlay.position === 'top' ? 'top-2' : overlay.position === 'bottom' ? 'bottom-2' : 'top-1/2 -translate-y-1/2';

  return (
    <div className="space-y-8">
      {/* Sound section */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Background Music Tracks</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MUSIC_TRACKS.map((track, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{track.name}</div>
                  <div className="text-xs text-gray-400">{track.genre}{track.bpm > 0 ? ` · ${track.bpm} BPM` : ''}</div>
                </div>
                <button
                  onClick={() => previewPlay(i)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${playingTrack === i ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {playingTrack === i ? '▶ Playing...' : '▶ Preview'}
                </button>
              </div>
              <WaveformSVG color={i === 0 ? '#f59e0b' : i === 1 ? '#8b5cf6' : i === 2 ? '#3b82f6' : i === 3 ? '#10b981' : '#6b7280'} playing={playingTrack === i} />
              <div className="flex gap-2 flex-wrap">
                {track.mood.map(m => (
                  <span key={m} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Volume: {trackVolumes[i]}%</label>
                <input
                  type="range" min={0} max={100} value={trackVolumes[i]}
                  onChange={e => setTrackVolumes(prev => { const n = [...prev]; n[i] = parseInt(e.target.value); return n; })}
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Text overlays */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Text Overlays</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex gap-2">
              {overlayStyles.map((s, i) => (
                <button key={i} onClick={() => setSelectedOverlay(i)} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${selectedOverlay === i ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'}`}>
                  {s.name}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Preview Text</label>
              <input value={previewText} onChange={e => setPreviewText(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="text-xs text-gray-500">Position: <span className="font-medium">{overlay.position}</span> · Font: <span className="font-medium">{overlay.fontSize}px</span></div>
          </div>

          {/* Preview */}
          <div className="relative bg-gray-900 rounded-xl overflow-hidden" style={{ height: 160 }}>
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">Video Preview</div>
            <div
              className={`absolute left-0 right-0 ${posStyle} mx-4 text-center px-3 py-1.5 rounded`}
              style={{ backgroundColor: overlay.bg, color: overlay.color, fontSize: overlay.fontSize }}
            >
              {previewText}
            </div>
          </div>
        </div>
      </div>

      {/* Captions */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Captions</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Select Lesson</label>
              <select value={captionLesson} onChange={e => setCaptionLesson(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— Select a lesson —</option>
                {allLessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
            <button
              onClick={() => {
                const lesson = allLessons.find(l => l.id === captionLesson);
                if (lesson) setSrtContent(generateSRT(lesson));
              }}
              disabled={!captionLesson}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              Generate SRT
            </button>
            {srtContent && (
              <button
                onClick={() => {
                  const blob = new Blob([srtContent], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'captions.srt'; a.click();
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Download .srt
              </button>
            )}
          </div>
          <div>
            {srtContent && (
              <textarea
                value={srtContent}
                onChange={e => setSrtContent(e.target.value)}
                rows={8}
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono resize-y"
                placeholder="SRT captions will appear here..."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 6: Tags, Labels & SEO ────────────────────────────────────────────────

function TagsSEOTab({ courses, onRefresh }: { courses: Course[]; onRefresh: () => void }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id ?? '');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [keywordText, setKeywordText] = useState('');
  const [topKeywords, setTopKeywords] = useState<[string, number][]>([]);
  const [aiWorking, setAiWorking] = useState<string | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [autoTagLessonId, setAutoTagLessonId] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  useEffect(() => {
    if (selectedCourse) {
      setSeoTitle(selectedCourse.seo_title ?? '');
      setSeoDesc(selectedCourse.seo_description ?? '');
    }
  }, [selectedCourse]);

  useEffect(() => {
    async function loadLessons() {
      const all: Lesson[] = [];
      for (const course of courses) {
        const res = await fetch(`/api/admin/course-studio/${course.id}/lessons`);
        if (!res.ok) continue;
        const d = await res.json();
        all.push(...(d.lessons ?? []));
      }
      setAllLessons(all);
    }
    if (courses.length) loadLessons();
  }, [courses]);

  // Tag cloud data
  const tagCounts: Record<string, number> = {};
  for (const course of courses) {
    for (const tag of course.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }
  const maxTagCount = Math.max(...Object.values(tagCounts), 1);

  // Label distribution
  const labelCounts: Record<string, number> = {};
  let totalLabels = 0;
  for (const lesson of allLessons) {
    for (const label of lesson.labels ?? []) {
      labelCounts[label] = (labelCounts[label] ?? 0) + 1;
      totalLabels++;
    }
  }

  function analyzeKeywords() {
    const words = keywordText.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
    const stopWords = new Set(['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','day','get','has','him','his','how','its','may','use','who','did','now','too','very']);
    const counts: Record<string, number> = {};
    for (const w of words) {
      if (!stopWords.has(w)) counts[w] = (counts[w] ?? 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    setTopKeywords(sorted);
  }

  async function seoAction(action: string) {
    if (!selectedCourseId) return;
    setAiWorking(action);
    try {
      const res = await fetch(`/api/admin/course-studio/${selectedCourseId}/seo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          title: selectedCourse?.title,
          objectives: selectedCourse?.learning_objectives ?? [],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.seo_title) setSeoTitle(data.seo_title);
        if (data.seo_description) setSeoDesc(data.seo_description);
        onRefresh();
      }
    } finally {
      setAiWorking(null);
    }
  }

  async function autoTag() {
    if (!autoTagLessonId || !selectedCourseId) return;
    const lesson = allLessons.find(l => l.id === autoTagLessonId);
    if (!lesson) return;
    setAiWorking('tags');
    try {
      const res = await fetch(`/api/admin/course-studio/${selectedCourseId}/seo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_tags', lesson_title: lesson.title, lesson_topic: lesson.title }),
      });
      const data = await res.json();
      if (res.ok) setSuggestedTags(data.tags ?? []);
    } finally {
      setAiWorking(null);
    }
  }

  async function saveSEO() {
    if (!selectedCourseId) return;
    await fetch(`/api/admin/course-studio/${selectedCourseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seo_title: seoTitle, seo_description: seoDesc }),
    });
    onRefresh();
  }

  return (
    <div className="space-y-8">
      {/* Tag cloud */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Course Tag Cloud</h3>
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-wrap gap-3 items-center">
          {Object.entries(tagCounts).length === 0 ? (
            <span className="text-gray-400 text-sm">No tags yet</span>
          ) : (
            Object.entries(tagCounts).map(([tag, count]) => (
              <span
                key={tag}
                className="text-indigo-700 bg-indigo-50 rounded-full px-3 py-1 cursor-default"
                style={{ fontSize: `${12 + (count / maxTagCount) * 14}px` }}
                title={`${count} course${count > 1 ? 's' : ''}`}
              >
                {tag}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Label distribution */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Lesson Label Distribution</h3>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4">
          {Object.entries(labelCounts).map(([label, count]) => {
            const pct = totalLabels > 0 ? Math.round((count / totalLabels) * 100) : 0;
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 capitalize">{label}</span>
                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-400">{pct}%</span>
              </div>
            );
          })}
          {totalLabels === 0 && <span className="text-gray-400 text-sm">No labeled lessons yet</span>}
        </div>
      </div>

      {/* Auto-tag */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">AI Auto-Tag Lesson</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Select Lesson</label>
            <select value={autoTagLessonId} onChange={e => setAutoTagLessonId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">— Select lesson —</option>
              {allLessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Course</label>
            <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <button onClick={autoTag} disabled={!autoTagLessonId || aiWorking === 'tags'} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            {aiWorking === 'tags' ? '...' : '✨ Auto-Tag'}
          </button>
        </div>
        {suggestedTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestedTags.map(tag => (
              <span key={tag} className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* SEO */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">SEO Optimization</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Course</label>
              <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">SEO Title</label>
                <span className={`text-xs ${seoTitle.length > 60 ? 'text-red-500' : 'text-gray-400'}`}>{seoTitle.length}/60</span>
              </div>
              <input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} maxLength={60} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <button onClick={() => seoAction('optimize_title')} disabled={!!aiWorking} className="mt-1 text-xs text-purple-600 hover:underline disabled:opacity-50">
                {aiWorking === 'optimize_title' ? 'Optimizing...' : '✨ Optimize Title'}
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">SEO Description</label>
                <span className={`text-xs ${seoDesc.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>{seoDesc.length}/160</span>
              </div>
              <textarea value={seoDesc} onChange={e => setSeoDesc(e.target.value)} maxLength={160} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
              <button onClick={() => seoAction('generate_description')} disabled={!!aiWorking} className="mt-1 text-xs text-purple-600 hover:underline disabled:opacity-50">
                {aiWorking === 'generate_description' ? 'Generating...' : '✨ Generate SEO Description'}
              </button>
            </div>
            <button onClick={saveSEO} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              Save SEO Fields
            </button>
          </div>

          {/* Keyword density */}
          <div className="space-y-3">
            <label className="text-xs text-gray-700 font-medium block">Keyword Density Checker</label>
            <textarea value={keywordText} onChange={e => setKeywordText(e.target.value)} rows={5} placeholder="Paste course description or lesson script to analyze keyword density..." className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
            <button onClick={analyzeKeywords} className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs hover:bg-gray-900">
              Analyze Keywords
            </button>
            {topKeywords.length > 0 && (
              <div className="space-y-1">
                {topKeywords.map(([word, count], i) => {
                  const totalWords = keywordText.split(/\s+/).filter(Boolean).length;
                  const pct = totalWords > 0 ? ((count / totalWords) * 100).toFixed(1) : '0';
                  return (
                    <div key={word} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-gray-400 text-right">{i+1}</span>
                      <span className="w-24 text-gray-700 font-medium truncate">{word}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(parseFloat(pct) * 20, 100)}%` }} />
                      </div>
                      <span className="w-12 text-gray-500 text-right">{count}x ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 7: Publishing & Distribution ────────────────────────────────────────

function PublishingTab({ courses, onRefresh }: { courses: Course[]; onRefresh: () => void }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id ?? '');
  const [courseDetail, setCourseDetail] = useState<{ course: Course; sections: Section[]; lessons: Lesson[]; quizzes: Quiz[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; errors?: string[]; message?: string } | null>(null);
  const [enrollmentMode, setEnrollmentMode] = useState<'public'|'private'|'password'>('public');
  const [certEnabled, setCertEnabled] = useState(false);
  const [dripEnabled, setDripEnabled] = useState(false);

  useEffect(() => {
    if (!selectedCourseId) return;
    setLoadingDetail(true);
    setPublishResult(null);
    fetch(`/api/admin/course-studio/${selectedCourseId}`)
      .then(r => r.json())
      .then(d => {
        setCourseDetail(d);
        setLoadingDetail(false);
      })
      .catch(() => setLoadingDetail(false));
  }, [selectedCourseId]);

  const course = courseDetail?.course ?? courses.find(c => c.id === selectedCourseId);
  const lessons = courseDetail?.lessons ?? [];
  const quizzes = courseDetail?.quizzes ?? [];
  const sections = courseDetail?.sections ?? [];

  const checks = course ? [
    {
      label: 'Course thumbnail uploaded',
      pass: !!course.thumbnail_url,
    },
    {
      label: 'Course description ≥ 100 words',
      pass: (course.description ?? '').split(/\s+/).filter(Boolean).length >= 100,
    },
    {
      label: 'All sections have at least 1 lesson',
      pass: sections.length > 0 && sections.every(s => (s.lessons?.length ?? 0) > 0),
    },
    {
      label: 'All lessons have a script',
      pass: lessons.length > 0 && lessons.every((l: Lesson) => l.ai_script || l.script_text),
    },
    {
      label: 'Promo video added',
      pass: !!course.promo_video_url,
    },
    {
      label: 'Price set (or marked free)',
      pass: course.is_free || !!course.price_cad,
    },
    {
      label: 'SEO title and description filled',
      pass: !!course.seo_title && !!course.seo_description,
    },
    {
      label: 'At least 1 quiz question added',
      pass: quizzes.length > 0,
    },
  ] : [];

  async function publishCourse() {
    if (!selectedCourseId) return;
    setPublishing(true);
    setPublishResult(null);
    const res = await fetch(`/api/admin/course-studio/${selectedCourseId}/publish`, { method: 'POST' });
    const data = await res.json();
    setPublishResult(data);
    setPublishing(false);
    if (data.success) onRefresh();
  }

  const PLATFORMS = [
    { name: 'SohamYoga Website', internal: true, icon: '🏠', url: null },
    { name: 'Udemy', internal: false, icon: '🎓', url: 'https://www.udemy.com/teaching/#/courses/create' },
    { name: 'Teachable', internal: false, icon: '📚', url: 'https://app.teachable.com/courses' },
    { name: 'Coursera', internal: false, icon: '🎯', url: 'https://coursera.org/for-business' },
    { name: 'Skill Share', internal: false, icon: '🎨', url: 'https://www.skillshare.com/teach' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Select Course to Publish</label>
        <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-64">
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      {/* Pre-publish checklist */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Pre-Publish Checklist</h3>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loadingDetail ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading checklist...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {checks.map((check, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-lg ${check.pass ? 'text-green-500' : 'text-red-400'}`}>
                    {check.pass ? '✓' : '✗'}
                  </span>
                  <span className={`text-sm ${check.pass ? 'text-gray-700' : 'text-red-600'}`}>{check.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-3 items-center">
          <button
            onClick={publishCourse}
            disabled={publishing || course?.status === 'published'}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {publishing ? 'Publishing...' : course?.status === 'published' ? 'Already Published' : 'Publish Course'}
          </button>
          {publishResult && (
            <div className={`text-sm px-3 py-1.5 rounded-lg ${publishResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {publishResult.success ? publishResult.message : (publishResult.errors ?? []).join('; ')}
            </div>
          )}
        </div>
      </div>

      {/* Distribution */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Distribution Platforms</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORMS.map(p => (
            <div key={p.name} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <div className="font-medium text-sm text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.internal ? 'Internal LMS' : 'External Platform'}</div>
                </div>
              </div>
              {p.internal ? (
                <button
                  onClick={publishCourse}
                  disabled={publishing}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {publishing ? 'Publishing...' : 'Publish Internally'}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500">Manual submission required:</div>
                  <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                    <li>Download course export from SohamYoga</li>
                    <li>Create instructor account on {p.name}</li>
                    <li>Upload videos and metadata</li>
                    <li>Submit for review</li>
                  </ol>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-indigo-600 hover:underline">
                      Open {p.name} →
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Enrollment settings */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Enrollment Settings</h3>
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">Access Mode</label>
            <div className="flex gap-3">
              {(['public','private','password'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setEnrollmentMode(mode)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors ${enrollmentMode === mode ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}
                >
                  {mode === 'public' ? '🌐 Public' : mode === 'private' ? '🔒 Private' : '🔑 Password'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-8">
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setCertEnabled(p => !p)} className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${certEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-transform ${certEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm text-gray-700">Certificate of Completion</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setDripEnabled(p => !p)} className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${dripEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-transform ${dripEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm text-gray-700">Drip Content (scheduled release)</span>
            </label>
          </div>

          {dripEnabled && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
              Drip content scheduling: lessons will be released according to a defined schedule after enrollment. Configure per-lesson release dates in the Lesson Builder tab.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'courses', label: 'Courses', icon: '🎓' },
  { id: 'builder', label: 'Lesson Builder', icon: '🔨' },
  { id: 'script', label: 'AI Script Generator', icon: '✨' },
  { id: 'tracker', label: 'Production Tracker', icon: '📊' },
  { id: 'sound', label: 'Sound & Text', icon: '🎵' },
  { id: 'tags', label: 'Tags, Labels & SEO', icon: '🏷️' },
  { id: 'publish', label: 'Publishing', icon: '🚀' },
];

export default function CourseStudioPage() {
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/course-studio');
      if (!res.ok) throw new Error('Failed to load courses');
      const data = await res.json();
      setCourses(data.courses ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCourses(); }, [loadCourses]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Course Production Studio</h1>
            <p className="text-sm text-gray-500 mt-0.5">Build, script, and publish your video courses</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{courses.length} course{courses.length !== 1 ? 's' : ''}</span>
            <a href="/admin/video-courses" className="text-sm text-indigo-600 hover:underline">Video Courses →</a>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-2xl mx-auto px-6">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {activeTab === 'courses' && (
          <CoursesTab courses={courses} loading={loading} onRefresh={loadCourses} />
        )}
        {activeTab === 'builder' && !loading && (
          <LessonBuilder courses={courses} onRefresh={loadCourses} />
        )}
        {activeTab === 'script' && (
          <ScriptGeneratorTab courses={courses} />
        )}
        {activeTab === 'tracker' && (
          <ProductionTracker courses={courses} />
        )}
        {activeTab === 'sound' && (
          <SoundAndTextTab courses={courses} />
        )}
        {activeTab === 'tags' && (
          <TagsSEOTab courses={courses} onRefresh={loadCourses} />
        )}
        {activeTab === 'publish' && (
          <PublishingTab courses={courses} onRefresh={loadCourses} />
        )}

        {loading && activeTab !== 'courses' && (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        )}
      </div>
    </div>
  );
}
