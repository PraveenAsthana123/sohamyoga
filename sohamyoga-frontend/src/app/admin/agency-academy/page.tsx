'use client';
import { useEffect, useState, useCallback } from 'react';

type Tab = 'courses' | 'curriculum' | 'enrollments' | 'settings';

interface Course {
  id: number;
  title: string;
  slug: string;
  category: string;
  description: string | null;
  modules: unknown[];
  duration_hours: number | null;
  level: string;
  instructor: string | null;
  status: string;
  enrolled_count: number;
  created_at: string;
}

interface Enrollment {
  id: number;
  course_slug: string;
  student_email: string;
  enrolled_at: string;
  completed_at: string | null;
  progress_pct: number;
}

const CATEGORIES = ['All', 'Marketing', 'SEO', 'Social', 'Analytics', 'Sales', 'Leadership'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  advanced: 'bg-red-100 text-red-700',
};

const CATEGORY_COLORS: Record<string, string> = {
  Marketing: 'bg-blue-100 text-blue-800',
  SEO: 'bg-orange-100 text-orange-800',
  Social: 'bg-pink-100 text-pink-800',
  Analytics: 'bg-purple-100 text-purple-800',
  Sales: 'bg-green-100 text-green-800',
  Leadership: 'bg-gray-100 text-gray-800',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-red-100 text-red-700',
};

export default function AgencyAcademyPage() {
  const [tab, setTab] = useState<Tab>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Add course modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '', slug: '', category: 'Marketing', description: '', level: 'beginner',
    duration_hours: '', instructor: '',
  });

  // Enroll modal
  const [enrollSlug, setEnrollSlug] = useState<string | null>(null);
  const [enrollEmail, setEnrollEmail] = useState('');

  // Curriculum builder
  const [currTitle, setCurrTitle] = useState('');
  const [currLevel, setCurrLevel] = useState('beginner');
  const [currHours, setCurrHours] = useState('10');
  const [curriculum, setCurriculum] = useState('');
  const [currLoading, setCurrLoading] = useState(false);

  // Enrollments
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);

  // Settings
  const [academySettings, setAcademySettings] = useState({
    name: 'Agency Academy', description: 'Upskill your team with expert-led marketing courses.', branding: 'Sohamyoga',
  });

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'All') params.set('category', categoryFilter);
      const r = await fetch(`/api/admin/agency-academy?${params}`);
      const d = await r.json();
      setCourses(d.courses || []);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  const fetchEnrollments = useCallback(async () => {
    setEnrollLoading(true);
    try {
      // Use the courses list to fetch enrollments per course — we'll use a dedicated admin query
      // Fetch via the main list (enrollments are embedded in course data via enrolled_count)
      // For a full enrollment table, we'd need a separate endpoint; here we show per-course counts
      setEnrollLoading(false);
    } catch {
      setEnrollLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);
  useEffect(() => { if (tab === 'enrollments') fetchEnrollments(); }, [tab, fetchEnrollments]);

  const handleAddCourse = async () => {
    if (!courseForm.title || !courseForm.slug || !courseForm.category) return;
    await fetch('/api/admin/agency-academy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...courseForm,
        duration_hours: courseForm.duration_hours ? parseFloat(courseForm.duration_hours) : null,
      }),
    });
    setShowAddModal(false);
    setCourseForm({ title: '', slug: '', category: 'Marketing', description: '', level: 'beginner', duration_hours: '', instructor: '' });
    fetchCourses();
  };

  const handlePublish = async (slug: string) => {
    await fetch(`/api/admin/agency-academy/${slug}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });
    fetchCourses();
  };

  const handleEnroll = async () => {
    if (!enrollSlug || !enrollEmail) return;
    await fetch(`/api/admin/agency-academy/${enrollSlug}/enroll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_email: enrollEmail }),
    });
    setEnrollSlug(null);
    setEnrollEmail('');
    fetchCourses();
  };

  const handleGenerateCurriculum = async () => {
    if (!currTitle) return;
    setCurrLoading(true);
    setCurriculum('');
    try {
      const r = await fetch('/api/admin/agency-academy/generate-curriculum', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: currTitle, level: currLevel, duration_hours: parseFloat(currHours) }),
      });
      const d = await r.json();
      setCurriculum(d.curriculum || d.error || 'No response');
    } catch {
      setCurriculum('Failed to connect to API');
    } finally {
      setCurrLoading(false);
    }
  };

  const TAB_LABELS: Record<Tab, string> = { courses: 'Courses', curriculum: 'Curriculum Builder', enrollments: 'Enrollments', settings: 'Settings' };

  const totalEnrolled = courses.reduce((sum, c) => sum + (c.enrolled_count || 0), 0);
  const publishedCount = courses.filter(c => c.status === 'published').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agency Academy</h1>
            <p className="text-gray-500 text-sm mt-1">Manage courses, curriculum, and learner enrollments</p>
          </div>
          {tab === 'courses' && (
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              + New Course
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold text-gray-900">{courses.length}</div>
            <div className="text-sm text-gray-500">Total Courses</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-600">{publishedCount}</div>
            <div className="text-sm text-gray-500">Published</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-600">{totalEnrolled}</div>
            <div className="text-sm text-gray-500">Total Enrollments</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Courses Tab */}
        {tab === 'courses' && (
          <>
            {/* Category filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${categoryFilter === cat ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="text-center py-16 text-gray-400">Loading courses...</div>
            ) : courses.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No courses found. Click &quot;New Course&quot; to get started.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map(course => (
                  <div key={course.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[course.category] || 'bg-gray-100 text-gray-700'}`}>
                        {course.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[course.status] || 'bg-gray-100 text-gray-700'}`}>
                        {course.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{course.title}</h3>
                    {course.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{course.description}</p>
                    )}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[course.level] || 'bg-gray-100 text-gray-700'}`}>
                        {course.level}
                      </span>
                      {course.duration_hours && (
                        <span className="text-xs text-gray-500">{course.duration_hours}h</span>
                      )}
                      {course.instructor && (
                        <span className="text-xs text-gray-500">by {course.instructor}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        {course.enrolled_count} enrolled
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEnrollSlug(course.slug)} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-medium">
                          Enroll
                        </button>
                        {course.status !== 'published' && (
                          <button onClick={() => handlePublish(course.slug)} className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 font-medium">
                            Publish
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Curriculum Builder Tab */}
        {tab === 'curriculum' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Generate Course Curriculum</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course Title *</label>
                  <input
                    value={currTitle}
                    onChange={e => setCurrTitle(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Advanced SEO for Digital Agencies"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                    <select value={currLevel} onChange={e => setCurrLevel(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      {LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                    <input
                      type="number"
                      value={currHours}
                      onChange={e => setCurrHours(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      min="1"
                      max="200"
                    />
                  </div>
                </div>
                <button
                  onClick={handleGenerateCurriculum}
                  disabled={currLoading || !currTitle}
                  className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {currLoading ? 'Generating curriculum...' : 'Generate Curriculum with AI'}
                </button>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Generated Curriculum</h2>
                {curriculum && !curriculum.includes('unavailable') && (
                  <button onClick={() => navigator.clipboard.writeText(curriculum)} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Copy</button>
                )}
              </div>
              {currLoading ? (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  <div className="text-center">
                    <div className="animate-pulse text-2xl mb-2">...</div>
                    <div className="text-sm">Designing your curriculum</div>
                  </div>
                </div>
              ) : curriculum ? (
                <div className="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{curriculum}</pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  Enter a course title and click Generate
                </div>
              )}
            </div>
          </div>
        )}

        {/* Enrollments Tab */}
        {tab === 'enrollments' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Course', 'Category', 'Level', 'Status', 'Enrolled Count', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No courses yet.</td></tr>
                )}
                {courses.map(course => (
                  <tr key={course.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{course.title}</div>
                      <div className="text-xs text-gray-400 font-mono">{course.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[course.category] || 'bg-gray-100 text-gray-700'}`}>{course.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[course.level] || 'bg-gray-100 text-gray-700'}`}>{course.level}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[course.status] || 'bg-gray-100 text-gray-700'}`}>{course.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{course.enrolled_count}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, course.enrolled_count * 10)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setEnrollSlug(course.slug)} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-medium">
                        + Enroll
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
            <h2 className="font-semibold text-gray-900 mb-4">Academy Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academy Name</label>
                <input value={academySettings.name} onChange={e => setAcademySettings(s => ({ ...s, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={academySettings.description} onChange={e => setAcademySettings(s => ({ ...s, description: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                <input value={academySettings.branding} onChange={e => setAcademySettings(s => ({ ...s, branding: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <button className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Course Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Course</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Course title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                <input value={courseForm.slug} onChange={e => setCourseForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" placeholder="course-slug" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select value={courseForm.category} onChange={e => setCourseForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <select value={courseForm.level} onChange={e => setCourseForm(f => ({ ...f, level: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Course description..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                  <input type="number" value={courseForm.duration_hours} onChange={e => setCourseForm(f => ({ ...f, duration_hours: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 8" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
                  <input value={courseForm.instructor} onChange={e => setCourseForm(f => ({ ...f, instructor: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Name" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleAddCourse} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Create Course</button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Modal */}
      {enrollSlug && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Enroll Student</h2>
            <p className="text-sm text-gray-500 mb-3">Course: <strong className="text-gray-700">{enrollSlug}</strong></p>
            <input
              type="email"
              value={enrollEmail}
              onChange={e => setEnrollEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
              placeholder="student@example.com"
            />
            <div className="flex gap-2">
              <button onClick={handleEnroll} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Enroll</button>
              <button onClick={() => setEnrollSlug(null)} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
