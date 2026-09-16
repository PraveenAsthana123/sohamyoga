'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard','courses','instructors','enrollments','reviews','ai-builder','analytics'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  courses: 'Courses',
  instructors: 'Instructors',
  enrollments: 'Enrollments',
  reviews: 'Reviews',
  'ai-builder': 'AI Course Builder',
  analytics: 'Analytics',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  review: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-red-100 text-red-600',
};
const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-blue-100 text-blue-700',
  intermediate: 'bg-purple-100 text-purple-700',
  advanced: 'bg-red-100 text-red-700',
  all_levels: 'bg-teal-100 text-teal-700',
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label.replace(/_/g, ' ')}</span>;
}
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue: 'border-l-4 border-blue-500 bg-blue-50',
    green: 'border-l-4 border-green-500 bg-green-50',
    amber: 'border-l-4 border-amber-500 bg-amber-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
    teal: 'border-l-4 border-teal-500 bg-teal-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] ?? borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400 text-sm">
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
      <span className="text-gray-500 ml-1 text-xs">{Number(rating).toFixed(1)}</span>
    </span>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────
function DashboardTab() {
  const [kpis, setKpis] = useState<Record<string, number> | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch('/api/admin/elearning-platform').then(r => r.json()).then(d => setKpis(d));
    fetch('/api/admin/elearning-platform/stats').then(r => r.json()).then(d => setStats(d));
  }, []);

  const topCourses = (stats?.top_courses as Record<string, unknown>[]) || [];
  const trend = (stats?.enrollment_trend as Record<string, unknown>[]) || [];
  const maxEnrollments = Math.max(...trend.map(t => Number(t.enrollments) || 0), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Total Courses" value={kpis?.total_courses ?? '…'} color="blue" />
        <KpiCard label="Active Enrollments" value={kpis?.active_enrollments ?? '…'} color="purple" />
        <KpiCard label="Revenue MTD" value={kpis ? `$${Number(kpis.revenue_mtd).toFixed(0)}` : '…'} color="green" />
        <KpiCard label="Avg Platform Rating" value={kpis ? `${Number(kpis.avg_platform_rating).toFixed(1)} ★` : '…'} color="amber" />
        <KpiCard label="Completions MTD" value={kpis?.completions_mtd ?? '…'} color="teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Enrollment Trend (6 months)</h3>
          <div className="flex items-end gap-2 h-28">
            {trend.map((t: Record<string, unknown>, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <div className="w-full bg-blue-500 rounded-t" style={{ height: `${(Number(t.enrollments) / maxEnrollments) * 100}%`, minHeight: '4px' }} />
                <p className="text-xs text-gray-400 mt-1 text-center">{String(t.month || '').split(' ')[0]}</p>
              </div>
            ))}
            {trend.length === 0 && <p className="text-gray-400 text-sm w-full text-center">No data yet</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Top 5 Courses by Enrollment</h3>
          {topCourses.length === 0
            ? <p className="text-gray-400 text-sm text-center py-8">No courses published yet</p>
            : <table className="w-full text-sm">
              <thead><tr className="text-gray-500 border-b text-left"><th className="pb-2">Course</th><th className="pb-2">Enrolled</th><th className="pb-2">Rating</th></tr></thead>
              <tbody>
                {topCourses.map((c: Record<string, unknown>) => (
                  <tr key={String(c.id)} className="border-b last:border-0">
                    <td className="py-2">
                      <p className="font-medium truncate max-w-xs">{String(c.title)}</p>
                      <p className="text-xs text-gray-400">{String(c.category)}</p>
                    </td>
                    <td className="py-2 text-gray-700">{String(c.enrollment_count)}</td>
                    <td className="py-2">{c.avg_rating ? <StarRating rating={Number(c.avg_rating)} /> : <span className="text-gray-300 text-xs">No reviews</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Courses Tab ────────────────────────────────────────────────────────────
function CoursesTab() {
  const [courses, setCourses] = useState<Record<string, unknown>[]>([]);
  const [instructors, setInstructors] = useState<Record<string, unknown>[]>([]);
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', instructor_id: '', category: 'business', level: 'beginner', price: '0', thumbnail_url: '', duration_hours: '', lessons_count: '0', certificate_enabled: true });
  const [saving, setSaving] = useState(false);

  const CATEGORIES = ['business','technology','marketing','design','health','finance','language','trades','personal_development','other'];

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (catFilter) params.set('category', catFilter);
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/admin/elearning-platform/courses?${params}`).then(r => r.json()).then(d => setCourses(d.courses || []));
  }, [catFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/admin/elearning-platform/instructors').then(r => r.json()).then(d => setInstructors(d.instructors || []));
  }, []);

  async function handlePublish(id: unknown) {
    await fetch(`/api/admin/elearning-platform/courses/${id}/publish`, { method: 'POST' });
    load();
  }
  async function handleArchive(id: unknown) {
    await fetch(`/api/admin/elearning-platform/courses/${id}`, { method: 'DELETE' });
    load();
  }
  async function handleAdd() {
    setSaving(true);
    await fetch('/api/admin/elearning-platform/courses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, price: parseFloat(form.price) || 0, duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : undefined, lessons_count: parseInt(form.lessons_count) || 0, instructor_id: form.instructor_id || undefined }),
    });
    setSaving(false);
    setShowAdd(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Statuses</option>
          {['draft','review','published','archived'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowAdd(true)} className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">+ Add Course</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c: Record<string, unknown>) => (
          <div key={String(c.id)} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{String(c.title)}</p>
                <p className="text-xs text-gray-400">{String(c.category).replace(/_/g, ' ')} · {String(c.instructor_first || '')} {String(c.instructor_last || '')}</p>
              </div>
              <Badge label={String(c.status)} cls={STATUS_COLORS[String(c.status)] || ''} />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Badge label={String(c.level)} cls={LEVEL_COLORS[String(c.level)] || ''} />
              <span className="text-sm font-medium text-gray-700">{Number(c.price) === 0 ? 'Free' : `$${Number(c.price).toFixed(2)}`}</span>
              <span className="text-xs text-gray-400 ml-auto">{String(c.enrolled_count)} enrolled</span>
            </div>
            {c.avg_rating && <div className="mb-3"><StarRating rating={Number(c.avg_rating)} /></div>}
            <div className="mt-auto flex gap-2 pt-3 border-t border-gray-100">
              {c.status !== 'published' && c.status !== 'archived' && (
                <button onClick={() => handlePublish(c.id)} className="flex-1 text-xs bg-green-600 text-white py-1.5 rounded hover:bg-green-700">Publish</button>
              )}
              {c.status !== 'archived' && (
                <button onClick={() => handleArchive(c.id)} className="flex-1 text-xs border border-gray-200 text-gray-500 py-1.5 rounded hover:bg-gray-50">Archive</button>
              )}
            </div>
          </div>
        ))}
        {courses.length === 0 && <p className="col-span-3 text-center py-10 text-gray-400">No courses found</p>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-screen overflow-y-auto p-6">
            <h3 className="text-lg font-semibold mb-4">Add Course</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Category *</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Level</label>
                  <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                    {['beginner','intermediate','advanced','all_levels'].map(l => <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Price ($)</label>
                  <input type="number" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duration (hrs)</label>
                  <input type="number" min="0" value={form.duration_hours} onChange={e => setForm(p => ({ ...p, duration_hours: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lessons Count</label>
                  <input type="number" min="0" value={form.lessons_count} onChange={e => setForm(p => ({ ...p, lessons_count: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Instructor</label>
                  <select value={form.instructor_id} onChange={e => setForm(p => ({ ...p, instructor_id: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                    <option value="">No instructor</option>
                    {instructors.map(i => <option key={String(i.id)} value={String(i.id)}>{i.first_name} {i.last_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Thumbnail URL</label>
                <input value={form.thumbnail_url} onChange={e => setForm(p => ({ ...p, thumbnail_url: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.certificate_enabled} onChange={e => setForm(p => ({ ...p, certificate_enabled: e.target.checked }))} />
                Certificate enabled
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdd} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Course'}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Instructors Tab ────────────────────────────────────────────────────────
function InstructorsTab() {
  const [instructors, setInstructors] = useState<Record<string, unknown>[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', bio: '', expertise: '', revenue_share_pct: '70' });
  const [saving, setSaving] = useState(false);

  const load = () => { fetch('/api/admin/elearning-platform/instructors').then(r => r.json()).then(d => setInstructors(d.instructors || [])); };
  useEffect(() => { load(); }, []);

  async function handleAdd() {
    setSaving(true);
    const expertise = form.expertise ? form.expertise.split(',').map(s => s.trim()).filter(Boolean) : [];
    await fetch('/api/admin/elearning-platform/instructors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, expertise, revenue_share_pct: parseFloat(form.revenue_share_pct) }),
    });
    setSaving(false);
    setShowAdd(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700">+ Add Instructor</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Instructor','Email','Expertise','Revenue Share','Courses','Est. Earnings','Status'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {instructors.map((i: Record<string, unknown>) => (
              <tr key={String(i.id)} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{String(i.first_name)} {String(i.last_name)}</p>
                  {i.bio && <p className="text-xs text-gray-400 truncate max-w-xs">{String(i.bio).slice(0, 60)}{String(i.bio).length > 60 ? '…' : ''}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{String(i.email)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(i.expertise) ? i.expertise as string[] : []).slice(0, 3).map((e, idx) => (
                      <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{e}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{String(i.revenue_share_pct)}%</td>
                <td className="px-4 py-3">{String(i.course_count)}</td>
                <td className="px-4 py-3">${Number(i.estimated_earnings).toFixed(2)}</td>
                <td className="px-4 py-3"><Badge label={String(i.status)} cls={i.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} /></td>
              </tr>
            ))}
            {instructors.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">No instructors yet</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Add Instructor</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {['first_name','last_name'].map(f => (
                  <div key={f}>
                    <label className="block text-xs text-gray-500 mb-1">{f.replace(/_/g, ' ')}</label>
                    <input value={String(form[f as keyof typeof form])} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bio</label>
                <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Expertise (comma-separated)</label>
                <input value={form.expertise} onChange={e => setForm(p => ({ ...p, expertise: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Revenue Share %</label>
                <input type="number" min="0" max="100" value={form.revenue_share_pct} onChange={e => setForm(p => ({ ...p, revenue_share_pct: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdd} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Instructor'}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Enrollments Tab ────────────────────────────────────────────────────────
function EnrollmentsTab() {
  const [enrollments, setEnrollments] = useState<Record<string, unknown>[]>([]);
  const [courses, setCourses] = useState<Record<string, unknown>[]>([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [completedFilter, setCompletedFilter] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (courseFilter) params.set('course_id', courseFilter);
    if (completedFilter) params.set('completed', completedFilter);
    fetch(`/api/admin/elearning-platform/enrollments?${params}`).then(r => r.json()).then(d => setEnrollments(d.enrollments || []));
  }, [courseFilter, completedFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/admin/elearning-platform/courses').then(r => r.json()).then(d => setCourses(d.courses || []));
  }, []);

  async function handleAction(id: unknown, action: string) {
    await fetch(`/api/admin/elearning-platform/enrollments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Courses</option>
          {courses.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.title)}</option>)}
        </select>
        <select value={completedFilter} onChange={e => setCompletedFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Statuses</option>
          <option value="true">Completed</option>
          <option value="false">In Progress</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Student','Course','Progress','Enrolled','Payment','Status','Actions'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {enrollments.map((e: Record<string, unknown>) => (
              <tr key={String(e.id)} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{String(e.student_name)}</p>
                  <p className="text-xs text-gray-400">{String(e.student_email)}</p>
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{String(e.course_title || '—')}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${Number(e.progress_pct)}%` }} />
                    </div>
                    <span className="text-xs text-gray-600">{String(e.progress_pct)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{e.enrolled_at ? new Date(String(e.enrolled_at)).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  <p>{Number(e.payment_amount) === 0 ? 'Free' : `$${Number(e.payment_amount).toFixed(2)}`}</p>
                  {e.payment_method && <p className="text-xs text-gray-400">{String(e.payment_method)}</p>}
                </td>
                <td className="px-4 py-3">
                  {e.refunded ? <Badge label="Refunded" cls="bg-red-100 text-red-600" />
                    : e.completed_at ? <Badge label="Completed" cls="bg-green-100 text-green-700" />
                      : <Badge label="In Progress" cls="bg-blue-100 text-blue-700" />}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {!e.completed_at && !e.refunded && (
                      <button onClick={() => handleAction(e.id, 'complete')} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Complete</button>
                    )}
                    {e.completed_at && !e.certificate_issued && (
                      <button onClick={() => handleAction(e.id, 'issue_certificate')} className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">Issue Cert</button>
                    )}
                    {e.certificate_issued && <Badge label="Cert Issued" cls="bg-purple-100 text-purple-700" />}
                    {!e.refunded && (
                      <button onClick={() => { if (confirm('Refund this enrollment?')) handleAction(e.id, 'refund'); }} className="text-xs border border-red-200 text-red-500 px-2 py-1 rounded hover:bg-red-50">Refund</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {enrollments.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">No enrollments found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Reviews Tab ─────────────────────────────────────────────────────────────
function ReviewsTab() {
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [courses, setCourses] = useState<Record<string, unknown>[]>([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (courseFilter) params.set('course_id', courseFilter);
    if (ratingFilter) params.set('min_rating', ratingFilter);
    fetch(`/api/admin/elearning-platform/reviews?${params}`).then(r => r.json()).then(d => setReviews(d.reviews || []));
  }, [courseFilter, ratingFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/admin/elearning-platform/courses').then(r => r.json()).then(d => setCourses(d.courses || []));
  }, []);

  async function toggleFeatured(id: unknown, current: boolean) {
    await fetch(`/api/admin/elearning-platform/reviews/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_featured: !current }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Courses</option>
          {courses.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.title)}</option>)}
        </select>
        <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All Ratings</option>
          {[5,4,3,2,1].map(r => <option key={r} value={String(r)}>{r}+ stars</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reviews.map((r: Record<string, unknown>) => (
          <div key={String(r.id)} className={`bg-white rounded-xl border p-4 ${r.is_featured ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <StarRating rating={Number(r.rating)} />
                <p className="text-xs text-gray-500 mt-0.5">{String(r.student_name || 'Anonymous')} · {String(r.course_title || '—')}</p>
              </div>
              <button onClick={() => toggleFeatured(r.id, Boolean(r.is_featured))}
                className={`text-xs px-2 py-1 rounded border ${r.is_featured ? 'bg-amber-100 text-amber-700 border-amber-300' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                {r.is_featured ? '★ Featured' : 'Feature'}
              </button>
            </div>
            {r.review_text && <p className="text-sm text-gray-700 mt-2">{String(r.review_text)}</p>}
            <p className="text-xs text-gray-400 mt-2">{r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : ''}</p>
          </div>
        ))}
        {reviews.length === 0 && <p className="col-span-2 text-center py-10 text-gray-400">No reviews found</p>}
      </div>
    </div>
  );
}

// ─── AI Course Builder Tab ───────────────────────────────────────────────────
function AIBuilderTab() {
  const CATEGORIES = ['business','technology','marketing','design','health','finance','language','trades','personal_development','other'];
  const [outlineForm, setOutlineForm] = useState({ course_title: '', level: 'beginner', category: 'business' });
  const [scriptForm, setScriptForm] = useState({ lesson_title: '', course_title: '', level: 'beginner', duration: '15' });
  const [outline, setOutline] = useState('');
  const [script, setScript] = useState('');
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [loadingScript, setLoadingScript] = useState(false);

  async function generateOutline() {
    setLoadingOutline(true);
    const res = await fetch('/api/admin/elearning-platform/ai-course-outline', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outlineForm),
    });
    const data = await res.json();
    setOutline(data.outline || '');
    setLoadingOutline(false);
  }

  async function generateScript() {
    setLoadingScript(true);
    const res = await fetch('/api/admin/elearning-platform/ai-lesson-script', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...scriptForm, duration: parseInt(scriptForm.duration) || 15 }),
    });
    const data = await res.json();
    setScript(data.script || '');
    setLoadingScript(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Course Outline Generator */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Course Outline Generator</h3>
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Course Title *</label>
            <input value={outlineForm.course_title} onChange={e => setOutlineForm(p => ({ ...p, course_title: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="e.g. Digital Marketing for Small Business" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Level</label>
              <select value={outlineForm.level} onChange={e => setOutlineForm(p => ({ ...p, level: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                {['beginner','intermediate','advanced','all_levels'].map(l => <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select value={outlineForm.category} onChange={e => setOutlineForm(p => ({ ...p, category: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <button onClick={generateOutline} disabled={loadingOutline || !outlineForm.course_title}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
            {loadingOutline ? 'Generating…' : 'Generate Course Outline'}
          </button>
        </div>
        {outline && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <h4 className="font-medium text-gray-700 text-sm">Course Outline</h4>
              <button onClick={() => navigator.clipboard.writeText(outline)} className="text-xs text-blue-600 hover:underline">Copy</button>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">{outline}</pre>
          </div>
        )}
      </div>

      {/* Lesson Script Generator */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Lesson Script Generator</h3>
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Lesson Title *</label>
            <input value={scriptForm.lesson_title} onChange={e => setScriptForm(p => ({ ...p, lesson_title: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="e.g. Introduction to SEO Basics" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Course Title *</label>
            <input value={scriptForm.course_title} onChange={e => setScriptForm(p => ({ ...p, course_title: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" placeholder="e.g. Digital Marketing for Small Business" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Level</label>
              <select value={scriptForm.level} onChange={e => setScriptForm(p => ({ ...p, level: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm">
                {['beginner','intermediate','advanced','all_levels'].map(l => <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
              <input type="number" min="5" max="120" value={scriptForm.duration} onChange={e => setScriptForm(p => ({ ...p, duration: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <button onClick={generateScript} disabled={loadingScript || !scriptForm.lesson_title || !scriptForm.course_title}
            className="w-full bg-purple-600 text-white py-2 rounded font-medium hover:bg-purple-700 disabled:opacity-50">
            {loadingScript ? 'Generating…' : 'Generate Lesson Script'}
          </button>
        </div>
        {script && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <h4 className="font-medium text-gray-700 text-sm">Lesson Script</h4>
              <button onClick={() => navigator.clipboard.writeText(script)} className="text-xs text-blue-600 hover:underline">Copy</button>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">{script}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Analytics Tab ───────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch('/api/admin/elearning-platform/stats').then(r => r.json()).then(d => setStats(d));
  }, []);

  const revenueByCategory = (stats?.revenue_by_category as Record<string, unknown>[]) || [];
  const completionRates = (stats?.completion_rates as Record<string, unknown>[]) || [];
  const maxRevenue = Math.max(...revenueByCategory.map(r => Number(r.revenue) || 0), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Revenue by Category</h3>
          <div className="space-y-3">
            {revenueByCategory.map((r: Record<string, unknown>) => (
              <div key={String(r.category)}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{String(r.category).replace(/_/g, ' ')}</span>
                  <span className="font-medium">${Number(r.revenue).toFixed(0)} <span className="text-gray-400 font-normal">({String(r.enrollments)} students)</span></span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full">
                  <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${(Number(r.revenue) / maxRevenue) * 100}%` }} />
                </div>
              </div>
            ))}
            {revenueByCategory.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No data yet</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Completion Rates by Course</h3>
          <div className="space-y-3">
            {completionRates.map((c: Record<string, unknown>) => (
              <div key={String(c.id)}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 truncate max-w-xs">{String(c.title)}</span>
                  <span className="font-medium ml-2 shrink-0">{String(c.completion_rate)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full">
                  <div className={`h-2 rounded-full ${Number(c.completion_rate) >= 70 ? 'bg-green-500' : Number(c.completion_rate) >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                    style={{ width: `${Number(c.completion_rate)}%` }} />
                </div>
                <p className="text-xs text-gray-400">{String(c.completed)}/{String(c.total_enrolled)} students completed</p>
              </div>
            ))}
            {completionRates.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No published courses yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ELearningPlatformPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">E-Learning &amp; Online Course Platform</h1>
          <p className="text-sm text-gray-500 mt-0.5">Courses, instructors, enrollments, reviews, and AI content tools</p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'courses' && <CoursesTab />}
        {activeTab === 'instructors' && <InstructorsTab />}
        {activeTab === 'enrollments' && <EnrollmentsTab />}
        {activeTab === 'reviews' && <ReviewsTab />}
        {activeTab === 'ai-builder' && <AIBuilderTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </div>
    </div>
  );
}
