import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { BlogPost } from '@/lib/api';
import SafeHtml from '@/components/SafeHtml';
import { SERVER_API_URL as API_URL } from '@/lib/server-api';

interface BlogPostPageProps {
  params: { slug: string };
}

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_URL}/api/blog/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getRecentPosts(): Promise<BlogPost[]> {
  try {
    const res = await fetch(`${API_URL}/api/blog/recent?count=3`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = await getPost(params.slug);

  if (!post) {
    return { title: 'Post Not Found' };
  }

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.summary,
    openGraph: {
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.summary,
      type: 'article',
      publishedTime: post.publishedAt || post.createdAt,
      authors: [post.authorName],
      ...(post.featuredImageUrl && { images: [{ url: post.featuredImageUrl }] }),
    },
  };
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function parseTags(tagsString?: string): string[] {
  if (!tagsString) return [];
  try {
    const parsed = JSON.parse(tagsString);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // If not valid JSON, try comma-separated
    return tagsString.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const [post, recentPosts] = await Promise.all([
    getPost(params.slug),
    getRecentPosts(),
  ]);

  if (!post) {
    notFound();
  }

  const tags = parseTags(post.tags);
  const relatedPosts = recentPosts.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <>
      {/* Hero Section */}
      <section className="gradient-bg pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-primary-200 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>

          {post.category && (
            <span className="inline-block px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-full mb-4">
              {post.category.name}
            </span>
          )}

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-primary-200">
            <span className="flex items-center gap-2">
              <span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                {post.authorName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
              {post.authorName}
            </span>
            <span className="text-primary-300">|</span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(post.publishedAt || post.createdAt)}
            </span>
            {post.viewCount > 0 && (
              <>
                <span className="text-primary-300">|</span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {post.viewCount.toLocaleString()} views
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Article Content */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Featured Image */}
          {post.featuredImageUrl && (
            <div className="relative -mt-24 mb-10 rounded-xl overflow-hidden shadow-2xl">
              <img
                src={post.featuredImageUrl}
                alt={post.title}
                className="w-full h-auto max-h-[480px] object-cover"
              />
            </div>
          )}

          {/* Summary */}
          <div className="mb-8 p-6 bg-primary-50 border-l-4 border-primary-500 rounded-r-lg">
            <p className="text-dark-700 text-lg leading-relaxed italic">
              {post.summary}
            </p>
          </div>

          {/* HTML Content */}
          <SafeHtml html={post.content} className="prose-content text-dark-700 leading-relaxed" />

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-12 pt-8 border-t border-dark-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-dark-600 mr-2">Tags:</span>
                {tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog?tag=${encodeURIComponent(tag)}`}
                    className="px-3 py-1 bg-dark-100 text-dark-600 text-sm rounded-full hover:bg-primary-100 hover:text-primary-700 transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Author Card */}
          <div className="mt-10 p-6 bg-dark-50 rounded-xl flex items-start gap-4">
            <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg flex-shrink-0">
              {post.authorName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <p className="font-semibold text-dark-900">{post.authorName}</p>
              <p className="text-sm text-dark-500 mt-1">
                Published on {formatDate(post.publishedAt || post.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16 bg-dark-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold text-dark-900 text-center mb-10">
              Related Articles
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedPosts.map((relPost) => (
                <article
                  key={relPost.id}
                  className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-dark-100"
                >
                  <div className="relative h-44 bg-gradient-to-br from-primary-100 to-accent-100">
                    {relPost.featuredImageUrl ? (
                      <img
                        src={relPost.featuredImageUrl}
                        alt={relPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-dark-400 mb-2">
                      {formatDate(relPost.publishedAt || relPost.createdAt)}
                    </p>
                    <h3 className="font-semibold text-dark-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
                      <Link href={`/blog/${relPost.slug}`}>{relPost.title}</Link>
                    </h3>
                    <p className="text-sm text-dark-500 line-clamp-2">{relPost.summary}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link href="/blog" className="btn-secondary">
                View All Articles
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
