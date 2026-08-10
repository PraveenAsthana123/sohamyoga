'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { customerAuthApi, liveChatApi, blogApi, CustomerUser, BlogPost } from '@/lib/api';

// ─── Featured Articles Carousel ───────────────────────────────────────────────
function FeaturedCarousel({ posts }: { posts: BlogPost[] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    timerRef.current = setInterval(() => {
      setCurrent((p) => (p + 1) % posts.length);
    }, 5000);
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (posts.length > 1) start();
    return stop;
  }, [posts.length]);

  const go = (idx: number) => {
    stop();
    setCurrent(idx);
    start();
  };

  if (posts.length === 0) return null;

  const post = posts[current];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Featured Articles</h2>
        <Link href="/customer/blog" className="text-sm text-blue-600 hover:underline">
          View all →
        </Link>
      </div>

      <div
        className="relative rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm"
        style={{ minHeight: '220px' }}
        onMouseEnter={stop}
        onMouseLeave={start}
      >
        {/* Background image / gradient */}
        {post.featuredImageUrl ? (
          <div className="absolute inset-0">
            <img
              src={post.featuredImageUrl}
              alt={post.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 via-gray-900/50 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700" />
        )}

        {/* Content overlay */}
        <div className="relative z-10 p-6 flex flex-col justify-end h-full" style={{ minHeight: '220px' }}>
          <div className="mt-auto">
            {post.category && (
              <span className="inline-block text-xs font-semibold bg-white/20 text-white px-2.5 py-0.5 rounded-full mb-2 backdrop-blur-sm">
                {post.category.name}
              </span>
            )}
            <h3 className="text-xl font-bold text-white leading-snug line-clamp-2">
              {post.title}
            </h3>
            <p className="text-white/80 text-sm mt-1 line-clamp-2">{post.summary}</p>

            <div className="flex items-center gap-4 mt-4">
              <Link
                href={`/customer/blog/${post.slug}`}
                className="inline-flex items-center gap-1.5 bg-white text-blue-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Read Article
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <span className="text-white/60 text-xs">
                {post.authorName} · {new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Prev / Next arrows */}
        {posts.length > 1 && (
          <>
            <button
              onClick={() => go((current - 1 + posts.length) % posts.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              onClick={() => go((current + 1) % posts.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors"
              aria-label="Next"
            >
              ›
            </button>
          </>
        )}

        {/* Dot indicators */}
        {posts.length > 1 && (
          <div className="absolute bottom-4 right-4 z-20 flex gap-1.5">
            {posts.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className={`rounded-full transition-all ${i === current ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/70'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function CustomerDashboardPage() {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [chatSessions, setChatSessions] = useState<
    { sessionId: string; messageCount: number; lastMessage?: string; lastMessageAt?: string }[]
  >([]);
  const [featuredPosts, setFeaturedPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      customerAuthApi.me(),
      liveChatApi.getCustomerSessions(),
      blogApi.getRecent(5),
    ])
      .then(([u, sessions, posts]) => {
        setUser(u);
        setChatSessions(sessions);
        setFeaturedPosts(posts.filter((p) => p.isPublished !== false));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name ?? 'Customer'}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Here&apos;s an overview of your activity.</p>
      </div>

      {/* Featured Articles Carousel */}
      <FeaturedCarousel posts={featuredPosts} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Chat Sessions</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{chatSessions.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Total Messages</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">
            {chatSessions.reduce((s, c) => s + c.messageCount, 0)}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/customer/chat"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            💬 Start Live Chat
          </Link>
          <Link
            href="/customer/blog"
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            📖 Browse Articles
          </Link>
          <Link
            href="/contact"
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            📧 Contact Support
          </Link>
        </div>
      </div>

      {/* Recent Sessions */}
      {chatSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Chat Sessions</h2>
          <div className="space-y-2">
            {chatSessions.slice(0, 5).map((s) => (
              <Link
                key={s.sessionId}
                href={`/customer/chat?session=${s.sessionId}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate max-w-xs">
                      {s.lastMessage ?? 'No messages'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.messageCount} messages</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-4">
                    {s.lastMessageAt ? new Date(s.lastMessageAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
