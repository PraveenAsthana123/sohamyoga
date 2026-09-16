'use client';
import { useEffect, useState, useCallback } from 'react';

type ContentType = 'blog' | 'email' | 'social' | 'video' | 'podcast';
type Status = 'draft' | 'scheduled' | 'published';

interface CalendarItem {
  id: number;
  title: string;
  content_type: ContentType;
  platform: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: Status;
  content_body: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  campaign_id: number | null;
  created_at: string;
}

interface Stats {
  total_month: string;
  published: string;
  scheduled: string;
  draft: string;
}

const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  blog: 'bg-blue-100 text-blue-800',
  email: 'bg-purple-100 text-purple-800',
  social: 'bg-green-100 text-green-800',
  video: 'bg-red-100 text-red-800',
  podcast: 'bg-yellow-100 text-yellow-800',
};

const STATUS_COLORS: Record<Status, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
};

const PLATFORMS = ['All', 'Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'YouTube', 'TikTok', 'Email', 'Website'];
const CONTENT_TYPES: ContentType[] = ['blog', 'email', 'social', 'video', 'podcast'];
const STATUSES: Status[] = ['draft', 'scheduled', 'published'];

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // Pad start with nulls for day-of-week offset
  const startDow = first.getDay(); // 0=Sun
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, -startDow + i + 1);
    days.push(d);
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

export default function PublishingCalendarPage() {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [form, setForm] = useState({
    title: '', content_type: 'blog' as ContentType, platform: '',
    scheduled_at: '', content_body: '', tags: '', assigned_to: '',
  });

  const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month: monthStr });
      if (filterPlatform !== 'All') params.set('platform', filterPlatform);
      if (filterType !== 'All') params.set('content_type', filterType);
      if (filterStatus !== 'All') params.set('status', filterStatus);
      const r = await fetch(`/api/admin/publishing-calendar?${params}`);
      const d = await r.json();
      setItems(d.items || []);
      setStats(d.stats || null);
    } finally {
      setLoading(false);
    }
  }, [monthStr, filterPlatform, filterType, filterStatus]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = async () => {
    if (!form.title || !form.content_type) return;
    const body = {
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
      scheduled_at: form.scheduled_at || null,
    };
    await fetch('/api/admin/publishing-calendar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setShowAddModal(false);
    setForm({ title: '', content_type: 'blog', platform: '', scheduled_at: '', content_body: '', tags: '', assigned_to: '' });
    fetchItems();
  };

  const handleStatusChange = async (id: number, status: Status) => {
    await fetch(`/api/admin/publishing-calendar/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    fetchItems();
  };

  const handleAIBrief = async () => {
    if (!aiTopic) return;
    setAiLoading(true);
    setAiResult('');
    try {
      const prompt = `You are a content strategist. Generate a detailed content brief outline for the following topic: "${aiTopic}". Include: hook/headline options, key points to cover (5-7 bullet points), target audience, recommended format, SEO keywords, call-to-action ideas, and estimated word count. Be concise and actionable.`;
      const r = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const d = await r.json();
      setAiResult(d.response || 'No response');
    } catch {
      setAiResult('AI service unavailable. Check Ollama is running on port 11434.');
    } finally {
      setAiLoading(false);
    }
  };

  const days = getMonthDays(currentYear, currentMonth);
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
    else setCurrentMonth(m => m + 1);
  };

  const getItemsForDay = (day: Date) => {
    const dayStr = day.toISOString().slice(0, 10);
    return items.filter(it => it.scheduled_at && it.scheduled_at.slice(0, 10) === dayStr);
  };

  const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Publishing Calendar</h1>
            <p className="text-gray-500 text-sm mt-1">Plan and track content across all platforms</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAIModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
              AI Content Brief
            </button>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              + Add Content
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'This Month', value: stats.total_month, color: 'text-gray-900' },
              { label: 'Published', value: stats.published, color: 'text-green-600' },
              { label: 'Scheduled', value: stats.scheduled, color: 'text-blue-600' },
              { label: 'Draft', value: stats.draft, color: 'text-gray-500' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-sm text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="flex gap-1">
            <button onClick={() => setView('calendar')} className={`px-3 py-1.5 rounded text-sm font-medium ${view === 'calendar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Calendar</button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded text-sm font-medium ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>List</button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={prevMonth} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700">&lt;</button>
            <span className="font-medium text-gray-900 min-w-[160px] text-center">{monthName}</span>
            <button onClick={nextMonth} className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700">&gt;</button>
          </div>
          <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700">
            {PLATFORMS.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700">
            <option value="All">All Types</option>
            {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700">
            <option value="All">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : view === 'calendar' ? (
          /* Calendar Grid */
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-200">
              {DOW_LABELS.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2 bg-gray-50">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, idx) => {
                const isCurrentMonth = day.getMonth() === currentMonth;
                const dayItems = getItemsForDay(day);
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={idx} className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${!isCurrentMonth ? 'bg-gray-50' : ''}`}>
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayItems.slice(0, 3).map(item => (
                        <div key={item.id} className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer ${CONTENT_TYPE_COLORS[item.content_type]}`} title={item.title}>
                          {item.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <div className="text-xs text-gray-400">+{dayItems.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Title', 'Type', 'Platform', 'Scheduled', 'Status', 'Assigned To', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No content scheduled for this period</td></tr>
                )}
                {items.map(item => (
                  <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{item.title}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONTENT_TYPE_COLORS[item.content_type]}`}>{item.content_type}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.platform || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{item.scheduled_at ? new Date(item.scheduled_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}>{item.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.assigned_to || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={item.status}
                        onChange={e => handleStatusChange(item.id, e.target.value as Status)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700"
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Content Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Content</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Content title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value as ContentType }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                  <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {PLATFORMS.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date & Time</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Body</label>
                <textarea value={form.content_body} onChange={e => setForm(f => ({ ...f, content_body: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Content notes or body..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                  <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="seo, summer, promo" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                  <input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Team member" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleAdd} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Add Content</button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Content Brief Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">AI Content Brief Generator</h2>
            <div className="flex gap-2 mb-4">
              <input
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Enter topic (e.g. 'Benefits of morning yoga for stress relief')"
                onKeyDown={e => e.key === 'Enter' && handleAIBrief()}
              />
              <button onClick={handleAIBrief} disabled={aiLoading} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                {aiLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
            {aiResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-80 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{aiResult}</pre>
              </div>
            )}
            <button onClick={() => setShowAIModal(false)} className="mt-4 w-full bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
