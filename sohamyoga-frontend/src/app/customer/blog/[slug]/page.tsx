'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { blogApi, BlogPost } from '@/lib/api';
import SafeHtml from '@/components/SafeHtml';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function parseTags(tagsString?: string): string[] {
  if (!tagsString) return [];
  try {
    const parsed = JSON.parse(tagsString);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return tagsString.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

export default function CustomerBlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([blogApi.getBySlug(slug), blogApi.getRecent(4)])
      .then(([p, recent]) => {
        setPost(p);
        setRelated(recent.filter((r) => r.slug !== slug).slice(0, 3));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-2xl text-center py-20">
        <p className="text-5xl mb-4">📭</p>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Article not found</h2>
        <Link href="/customer/blog" className="text-blue-600 hover:underline text-sm">
          Back to Blog
        </Link>
      </div>
    );
  }

  const tags = parseTags(post.tags);

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <Link
        href="/customer/blog"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Blog
      </Link>

      {/* Category badge */}
      {post.category && (
        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          {post.category.name}
        </span>
      )}

      {/* Title */}
      <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900 leading-snug">{post.title}</h1>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs">
            {post.authorName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </span>
          {post.authorName}
        </span>
        <span className="text-gray-300">|</span>
        <span>{formatDate(post.publishedAt || post.createdAt)}</span>
        {post.viewCount > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <span>{post.viewCount.toLocaleString()} views</span>
          </>
        )}
      </div>

      {/* Featured image */}
      {post.featuredImageUrl && (
        <div className="mt-6 rounded-xl overflow-hidden">
          <img
            src={post.featuredImageUrl}
            alt={post.title}
            className="w-full h-auto max-h-80 object-cover"
          />
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
        <p className="text-gray-700 italic leading-relaxed">{post.summary}</p>
      </div>

      {/* Content */}
      <SafeHtml
        html={post.content}
        className="mt-8 prose max-w-none text-gray-700 leading-relaxed prose-headings:text-gray-900 prose-a:text-blue-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded"
      />

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-wrap gap-2">
          <span className="text-sm font-semibold text-gray-600 mr-1">Tags:</span>
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/customer/blog?search=${encodeURIComponent(tag)}`}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}

      {/* Related */}
      {related.length > 0 && (
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Articles</h2>
          <div className="space-y-3">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/customer/blog/${r.slug}`}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                {r.featuredImageUrl ? (
                  <img src={r.featuredImageUrl} alt={r.title} className="w-16 h-12 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-16 h-12 bg-blue-50 rounded-lg flex-shrink-0 flex items-center justify-center text-xl">📄</div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 transition-colors line-clamp-2">{r.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(r.publishedAt || r.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
          <Link href="/customer/blog" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            View all articles →
          </Link>
        </div>
      )}
    </div>
  );
}
