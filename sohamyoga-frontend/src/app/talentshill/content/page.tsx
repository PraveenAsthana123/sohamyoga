'use client';

import { useEffect, useState } from 'react';

interface ContentItem {
  id?: string;
  title?: string;
  content?: string;
  platform?: string;
  status?: string;
  scheduledAt?: string;
  type?: string;
  [key: string]: unknown;
}

interface SocialApiResponse {
  drafts?: ContentItem[];
  scheduled?: ContentItem[];
  [key: string]: unknown;
}

type CalendarDay = {
  date: Date;
  items: ContentItem[];
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  published: 'bg-green-500/20 text-green-300 border-green-400/30',
  pending: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  facebook: '👤',
  twitter: '🐦',
  linkedin: '💼',
  youtube: '▶️',
  tiktok: '🎵',
  blog: '✍️',
  email: '📧',
  default: '📝',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildCalendar(year: number, month: number, items: ContentItem[]): CalendarDay[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalendarDay[] = [];

  for (let i = 0; i < firstDay; i++) {
    days.push({ date: new Date(year, month, -firstDay + 1 + i), items: [] });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayItems = items.filter((item) => {
      if (!item.scheduledAt) return false;
      const itemDate = new Date(item.scheduledAt);
      return (
        itemDate.getFullYear() === year &&
        itemDate.getMonth() === month &&
        itemDate.getDate() === d
      );
    });
    days.push({ date, items: dayItems });
  }
  return days;
}

export default function TalentsHillContentPage() {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [viewMonth] = useState(now.getMonth());
  const [viewYear] = useState(now.getFullYear());

  useEffect(() => {
    fetch('/api/admin/social-media-management', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: SocialApiResponse) => {
        const items: ContentItem[] = [
          ...(data.drafts ?? []),
          ...(data.scheduled ?? []),
        ];
        setContentItems(items);
      })
      .catch(() => setContentItems([]))
      .finally(() => setLoading(false));
  }, []);

  const calendarDays = buildCalendar(viewYear, viewMonth, contentItems);

  const MONTH_NAME = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  const staticDrafts: ContentItem[] = contentItems.length > 0 ? contentItems : [
    { id: '1', title: 'Q4 Product Launch Teaser', platform: 'Instagram', status: 'draft', scheduledAt: new Date(viewYear, viewMonth, 18).toISOString() },
    { id: '2', title: 'Weekly Tips Carousel', platform: 'LinkedIn', status: 'scheduled', scheduledAt: new Date(viewYear, viewMonth, 20).toISOString() },
    { id: '3', title: 'Behind the Scenes Reel', platform: 'Instagram', status: 'draft', scheduledAt: new Date(viewYear, viewMonth, 22).toISOString() },
    { id: '4', title: 'October Newsletter', platform: 'Email', status: 'pending', scheduledAt: new Date(viewYear, viewMonth, 25).toISOString() },
    { id: '5', title: 'Case Study Blog Post', platform: 'Blog', status: 'draft', scheduledAt: new Date(viewYear, viewMonth, 28).toISOString() },
  ];

  const calendarItems = buildCalendar(viewYear, viewMonth, staticDrafts);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Content Calendar</h1>
        <p className="text-white/50 mt-1 text-sm">View, review, and track your scheduled content across all platforms.</p>
      </div>

      {/* Calendar Grid */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{MONTH_NAME}</h2>
          <span className="text-white/40 text-sm">{staticDrafts.length} items scheduled</span>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-white/10">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-white/40 text-xs font-medium py-3">
              {d}
            </div>
          ))}
        </div>
        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {calendarItems.map((day, i) => {
            const isCurrentMonth = day.date.getMonth() === viewMonth;
            const isToday =
              day.date.toDateString() === now.toDateString();
            return (
              <div
                key={i}
                className={`min-h-[80px] border-r border-b border-white/10 p-2 last:border-r-0 ${isCurrentMonth ? '' : 'opacity-30'}`}
              >
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-500 text-white' : 'text-white/60'}`}>
                  {day.date.getDate()}
                </div>
                {day.items.slice(0, 2).map((item, j) => (
                  <div
                    key={j}
                    className="text-xs bg-blue-500/20 border border-blue-400/20 text-blue-300 rounded px-1.5 py-0.5 mb-1 truncate"
                    title={item.title ?? item.content ?? ''}
                  >
                    {PLATFORM_ICONS[(item.platform ?? '').toLowerCase()] ?? '📝'}{' '}
                    {item.title ?? item.content ?? 'Content'}
                  </div>
                ))}
                {day.items.length > 2 && (
                  <div className="text-xs text-white/40">+{day.items.length - 2} more</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Drafts List */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">All Content Drafts</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-white/40">Loading content…</div>
        ) : (
          <div className="divide-y divide-white/10">
            {staticDrafts.map((item, i) => (
              <div key={item.id ?? i} className="px-6 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                <span className="text-2xl shrink-0">
                  {PLATFORM_ICONS[(item.platform ?? '').toLowerCase()] ?? '📝'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 font-medium text-sm truncate">{item.title ?? item.content ?? 'Untitled'}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {item.platform} · {item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_COLORS[item.status ?? 'draft'] ?? STATUS_COLORS['draft']}`}>
                  {item.status ?? 'draft'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
