'use client';

import { useEffect, useState, useCallback } from 'react';

interface Course {
  course_id: string;
  title: string;
  instructor: string;
  category: string;
  level: string;
  lesson_count: number;
  enrolled_count: number;
  completion_rate: string;
  is_published: boolean;
  created_at: string;
}

interface Lesson {
  lesson_id: string;
  course_id: string;
  title: string;
  duration_min: number;
  video_url: string | null;
  has_quiz: boolean;
  has_transcript: boolean;
  status: string;
}

interface Quiz {
  quiz_id: string;
  course_id: string;
  title: string;
  question_count: number;
  pass_score: number;
  avg_score: string;
  attempt_count: number;
}

interface Certificate {
  cert_id: string;
  course_id: string;
  template_name: string;
  auto_issue: boolean;
  issued_count: number;
}

interface Analytics {
  top_courses: { title: string; completion_rate: string }[];
  avg_watch_time_min: number;
}

interface PageData {
  courses: Course[];
  lessons: Lesson[];
  quizzes: Quiz[];
  certificates: Certificate[];
  analytics: Analytics;
}

const TABS = ['Courses', 'Lessons', 'Quizzes', 'Certificates', 'Analytics', 'Settings'] as const;
type Tab = typeof TABS[number];

const LEVEL_COLOR: Record<string, string> = {
  Beginner: 'bg-green-100 text-green-700',
  Intermediate: 'bg-yellow-100 text-yellow-700',
  Advanced: 'bg-red-100 text-red-700',
};

const STATUS_COLOR: Record<string, string> = {
  published: 'bg-green-100 text-green-700',
  processing: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-gray-100 text-gray-600',
};

export default function EducationVideoPage() {
  const [tab, setTab] = useState<Tab>('Courses');
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/education-video');
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const togglePublish = async (course_id: string, current: boolean) => {
    await fetch('/api/admin/education-video', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'course', course_id, is_published: !current }),
    });
    setMsg(`Course ${!current ? 'published' : 'archived'}`);
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading education data...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!data) return null;

  const { courses, lessons, quizzes, certificates, analytics } = data;
  const totalCourses = courses.length;
  const published = courses.filter(c => c.is_published).length;
  const totalLessons = lessons.length;
  const watchHours = Math.round(lessons.reduce((s, l) => s + l.duration_min, 0) / 60);

  const filteredLessons = lessons.filter(l =>
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    l.course_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Education Video Tech</h1>
        <p className="text-gray-500 text-sm mt-1">Manage courses, lessons, quizzes and certificates</p>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded text-sm">
          {msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Courses', value: totalCourses, color: 'bg-blue-50 border-blue-200' },
          { label: 'Published', value: published, color: 'bg-green-50 border-green-200' },
          { label: 'Total Lessons', value: totalLessons, color: 'bg-purple-50 border-purple-200' },
          { label: 'Watch Hours', value: watchHours + 'h', color: 'bg-orange-50 border-orange-200' },
        ].map(s => (
          <div key={s.label} className={`border rounded-lg p-4 ${s.color}`}>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Courses */}
      {tab === 'Courses' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['ID', 'Title', 'Instructor', 'Category', 'Level', 'Lessons', 'Enrolled', 'Completion', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courses.map(c => (
                <tr key={c.course_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.course_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                  <td className="px-4 py-3 text-gray-600">{c.instructor}</td>
                  <td className="px-4 py-3 text-gray-600">{c.category}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${LEVEL_COLOR[c.level] || 'bg-gray-100 text-gray-700'}`}>
                      {c.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.lesson_count}</td>
                  <td className="px-4 py-3 text-gray-600">{c.enrolled_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${c.completion_rate}%` }} />
                      </div>
                      <span className="text-xs text-gray-600">{c.completion_rate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${c.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {c.is_published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => togglePublish(c.course_id, c.is_published)}
                      className={`text-xs px-3 py-1 rounded ${c.is_published ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                      {c.is_published ? 'Archive' : 'Publish'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lessons */}
      {tab === 'Lessons' && (
        <div className="space-y-4">
          <input type="text" placeholder="Search lessons..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm" />
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  {['ID', 'Course', 'Title', 'Duration', 'Video', 'Quiz', 'Transcript', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLessons.map(l => (
                  <tr key={l.lesson_id} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{l.lesson_id}</td>
                    <td className="px-4 py-3 text-gray-600">{l.course_id}</td>
                    <td className="px-4 py-3 font-medium">{l.title}</td>
                    <td className="px-4 py-3 text-gray-600">{l.duration_min} min</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {l.video_url ? l.video_url.replace('https://vimeo.com/', 'vimeo/') : '—'}
                    </td>
                    <td className="px-4 py-3">{l.has_quiz ? '✓' : '—'}</td>
                    <td className="px-4 py-3">{l.has_transcript ? '✓' : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[l.status] || 'bg-gray-100 text-gray-600'}`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quizzes */}
      {tab === 'Quizzes' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                {['Quiz', 'Course', 'Questions', 'Pass Score', 'Avg Score', 'Attempts'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quizzes.map(q => (
                <tr key={q.quiz_id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{q.title}</td>
                  <td className="px-4 py-3 text-gray-600">{q.course_id}</td>
                  <td className="px-4 py-3 text-gray-600">{q.question_count}</td>
                  <td className="px-4 py-3 text-gray-600">{q.pass_score}%</td>
                  <td className="px-4 py-3">
                    <span className={Number(q.avg_score) >= Number(q.pass_score) ? 'text-green-600' : 'text-red-600'}>
                      {q.avg_score}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{q.attempt_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Certificates */}
      {tab === 'Certificates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {certificates.map(c => (
            <div key={c.cert_id} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center text-xl">🏆</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.auto_issue ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {c.auto_issue ? 'Auto-issue' : 'Manual'}
                </span>
              </div>
              <div className="font-semibold text-gray-900 mb-1">{c.template_name}</div>
              <div className="text-sm text-gray-500 mb-3">Course: {c.course_id}</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{c.issued_count} issued</span>
                <button className="text-xs text-blue-600 hover:underline">Preview</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analytics */}
      {tab === 'Analytics' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-3">Top Courses by Completion Rate</h2>
            <div className="space-y-3">
              {analytics.top_courses.map(c => (
                <div key={c.title} className="flex items-center gap-4">
                  <div className="w-48 text-sm text-gray-700 truncate">{c.title}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div className="bg-blue-500 h-3 rounded-full transition-all"
                      style={{ width: `${c.completion_rate}%` }} />
                  </div>
                  <div className="w-12 text-sm text-gray-600 text-right">{c.completion_rate}%</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-gray-600">Average Lesson Watch Time</div>
            <div className="text-3xl font-bold text-blue-700 mt-1">{analytics.avg_watch_time_min} min</div>
          </div>
        </div>
      )}

      {/* Settings */}
      {tab === 'Settings' && (
        <div className="max-w-lg space-y-4">
          {[
            { label: 'Autoplay next lesson', type: 'toggle', value: true },
            { label: 'Default quality', type: 'select', options: ['Auto', '1080p', '720p', '480p'] },
            { label: 'Closed captions default', type: 'toggle', value: false },
            { label: 'Certificate issuer name', type: 'text', value: 'SohamYoga Academy' },
            { label: 'Completion threshold (%)', type: 'number', value: '80' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">{s.label}</span>
              {s.type === 'toggle' ? (
                <div className={`w-11 h-6 rounded-full ${s.value ? 'bg-blue-500' : 'bg-gray-300'} relative cursor-pointer`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${s.value ? 'left-5' : 'left-0.5'}`} />
                </div>
              ) : s.type === 'select' ? (
                <select className="text-sm border border-gray-300 rounded px-2 py-1">
                  {s.options?.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type={s.type} defaultValue={s.value as string}
                  className="text-sm border border-gray-300 rounded px-2 py-1 w-40" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
