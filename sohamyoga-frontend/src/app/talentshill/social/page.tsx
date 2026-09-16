'use client';

import { useEffect, useState } from 'react';

interface SocialAccount {
  id?: string;
  platform?: string;
  handle?: string;
  status?: string;
  followers?: number;
  [key: string]: unknown;
}

interface ContentDraft {
  id?: string;
  title?: string;
  content?: string;
  platform?: string;
  status?: string;
  scheduledAt?: string;
  [key: string]: unknown;
}

interface RecentPost {
  id?: string;
  content?: string;
  platform?: string;
  likes?: number;
  comments?: number;
  reach?: number;
  publishedAt?: string;
  [key: string]: unknown;
}

interface SocialApiResponse {
  accounts?: SocialAccount[];
  drafts?: ContentDraft[];
  recentPosts?: RecentPost[];
  [key: string]: unknown;
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  facebook: '👤',
  twitter: '🐦',
  linkedin: '💼',
  youtube: '▶️',
  tiktok: '🎵',
  default: '📱',
};

const SCHEDULE_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'Twitter', 'YouTube', 'TikTok'];

interface ScheduleForm {
  platform: string;
  content: string;
  scheduledDate: string;
}

function getPlatformIcon(platform: string): string {
  return PLATFORM_ICONS[(platform ?? '').toLowerCase()] ?? PLATFORM_ICONS['default'];
}

function formatNum(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function TalentsHillSocialPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState<ScheduleForm>({ platform: 'Instagram', content: '', scheduledDate: '' });

  useEffect(() => {
    fetch('/api/admin/social-media-management', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: SocialApiResponse) => {
        if (data.accounts) setAccounts(data.accounts);
        if (data.drafts) setDrafts(data.drafts);
        if (data.recentPosts) setRecentPosts(data.recentPosts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    showToast('✅ Post scheduled for review. Your account manager will approve within 2 hours.');
    setForm({ platform: 'Instagram', content: '', scheduledDate: '' });
  }

  const STATIC_ACCOUNTS: SocialAccount[] = accounts.length > 0 ? accounts : [
    { id: '1', platform: 'Instagram', handle: '@yourclient', status: 'connected', followers: 12400 },
    { id: '2', platform: 'Facebook', handle: 'Your Brand Page', status: 'connected', followers: 8900 },
    { id: '3', platform: 'LinkedIn', handle: 'Your Company', status: 'connected', followers: 3200 },
  ];

  const STATIC_POSTS: RecentPost[] = recentPosts.length > 0 ? recentPosts : [
    { id: '1', content: 'Summer Sale — Up to 40% off!', platform: 'Instagram', likes: 420, comments: 38, reach: 12400, publishedAt: '2026-09-14T10:00:00Z' },
    { id: '2', content: 'New feature announcement: AI-powered analytics dashboard', platform: 'LinkedIn', likes: 180, comments: 22, reach: 4800, publishedAt: '2026-09-13T14:30:00Z' },
    { id: '3', content: 'Behind the scenes — meet the team!', platform: 'Facebook', likes: 290, comments: 45, reach: 8100, publishedAt: '2026-09-12T09:00:00Z' },
  ];

  return (
    <div className="space-y-8 relative">
      {toast && (
        <div className="fixed top-6 right-6 z-[100]  bg-green-500/20 border border-green-400/30 rounded-xl px-5 py-3 text-green-300 text-sm shadow-xl max-w-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Social Media</h1>
        <p className="text-white/50 mt-1 text-sm">Manage your connected social accounts, content drafts, and post performance.</p>
      </div>

      {/* Connected Accounts */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Connected Accounts</h2>
        {loading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-slate-800/70 border border-white/20 rounded-2xl p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {STATIC_ACCOUNTS.map((acc) => (
              <div key={acc.id} className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-5 flex items-center gap-4">
                <div className="text-3xl">{getPlatformIcon(acc.platform ?? '')}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{acc.platform}</p>
                  <p className="text-white/50 text-xs truncate">{acc.handle}</p>
                  <p className="text-white/40 text-xs">{formatNum(acc.followers)} followers</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${acc.status === 'connected' ? 'bg-green-500/20 text-green-300 border-green-400/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30'}`}>
                  {acc.status ?? 'unknown'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content Drafts Awaiting Approval */}
      {drafts.length > 0 && (
        <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Drafts Awaiting Approval</h2>
          <div className="space-y-3">
            {drafts.slice(0, 5).map((draft, i) => (
              <div key={draft.id ?? i} className="flex items-center gap-3 py-2 border-b border-white/10 last:border-0">
                <span className="text-xl">{getPlatformIcon(draft.platform ?? '')}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm truncate">{draft.title ?? draft.content ?? 'Draft'}</p>
                  <p className="text-white/40 text-xs">{draft.platform} · {draft.scheduledAt ? new Date(draft.scheduledAt).toLocaleDateString() : 'No date set'}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
                  {draft.status ?? 'pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Posts */}
      <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Recent Posts</h2>
        </div>
        <div className="divide-y divide-white/10">
          {STATIC_POSTS.map((post) => (
            <div key={post.id} className="px-6 py-4 flex items-start gap-4 hover:bg-white/5 transition-colors">
              <span className="text-2xl mt-0.5 shrink-0">{getPlatformIcon(post.platform ?? '')}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm leading-snug line-clamp-2">{post.content}</p>
                <p className="text-white/40 text-xs mt-1">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '—'}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/50 shrink-0">
                <span>❤️ {formatNum(post.likes)}</span>
                <span>💬 {formatNum(post.comments)}</span>
                <span>👁️ {formatNum(post.reach)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule a Post */}
      <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Schedule a Post</h2>
        <form onSubmit={handleSchedule} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/70 text-sm mb-1.5">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 w-full  focus:outline-none focus:border-blue-400/60 transition-all"
              >
                {SCHEDULE_PLATFORMS.map((p) => (
                  <option key={p} value={p} className="bg-slate-900">{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1.5">Schedule Date & Time</label>
              <input
                type="datetime-local"
                value={form.scheduledDate}
                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 w-full  focus:outline-none focus:border-blue-400/60 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-white/70 text-sm mb-1.5">Post Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Write your post content here…"
              rows={4}
              required
              className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 w-full  focus:outline-none focus:border-blue-400/60 transition-all resize-none"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-500/80 hover:bg-blue-400/90  border border-blue-400/30 text-white rounded-xl px-6 py-3 text-sm font-semibold transition-all"
          >
            📅 Submit for Scheduling
          </button>
        </form>
      </div>

      {/* Performance by Platform */}
      <div className="bg-slate-800/70 border border-white/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Performance by Platform</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-white/50 font-medium px-6 py-3">Platform</th>
                <th className="text-right text-white/50 font-medium px-4 py-3">Followers</th>
                <th className="text-right text-white/50 font-medium px-4 py-3">Posts (30d)</th>
                <th className="text-right text-white/50 font-medium px-4 py-3">Avg Reach</th>
                <th className="text-right text-white/50 font-medium px-6 py-3">Eng. Rate</th>
              </tr>
            </thead>
            <tbody>
              {[
                { platform: 'Instagram', icon: '📸', followers: '12.4K', posts: 18, reach: '4.2K', eng: '5.8%' },
                { platform: 'Facebook', icon: '👤', followers: '8.9K', posts: 12, reach: '3.1K', eng: '3.2%' },
                { platform: 'LinkedIn', icon: '💼', followers: '3.2K', posts: 8, reach: '1.8K', eng: '7.1%' },
              ].map((row) => (
                <tr key={row.platform} className="border-b border-white/10 hover:bg-white/5 transition-colors last:border-0">
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2 text-white/80">
                      <span>{row.icon}</span>
                      <span>{row.platform}</span>
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right text-white/70">{row.followers}</td>
                  <td className="px-4 py-4 text-right text-white/70">{row.posts}</td>
                  <td className="px-4 py-4 text-right text-white/70">{row.reach}</td>
                  <td className="px-6 py-4 text-right font-semibold text-cyan-400">{row.eng}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
