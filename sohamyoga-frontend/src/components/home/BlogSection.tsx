import Link from 'next/link';
import type { BlogPost } from '@/lib/api';

interface BlogSectionProps {
  posts: BlogPost[];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BlogSection({ posts }: BlogSectionProps) {
  if (!posts || posts.length === 0) return null;

  const recentPosts = posts.slice(0, 3);

  return (
    <section className="py-20 bg-dark-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-4">
              Latest from Our <span className="text-primary-600">Blog</span>
            </h2>
            <p className="text-lg text-dark-500 max-w-2xl">
              Insights, tutorials, and thought leadership on AI, technology, and digital transformation.
            </p>
          </div>
          <Link
            href="/blog"
            className="btn-secondary text-sm mt-6 sm:mt-0 flex-shrink-0"
          >
            View All Posts
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {recentPosts.map((post, index) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group block"
            >
              <article className="card border border-dark-100 p-0 overflow-hidden h-full group-hover:-translate-y-1 transition-all duration-300">
                {/* Gradient header */}
                <div className={`relative aspect-[16/9] overflow-hidden ${
                  index === 0
                    ? 'bg-gradient-to-br from-primary-600 to-primary-800'
                    : index === 1
                    ? 'bg-gradient-to-br from-accent-600 to-primary-700'
                    : 'bg-gradient-to-br from-dark-700 to-primary-900'
                }`}>
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-3 right-3 w-20 h-20 bg-white rounded-full blur-xl" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center px-6">
                    <p className="text-white/80 text-sm font-medium text-center line-clamp-2">{post.title}</p>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Meta */}
                  <div className="flex items-center gap-3 mb-3">
                    {post.category && (
                      <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs font-medium rounded">
                        {post.category.name}
                      </span>
                    )}
                    <span className="text-dark-400 text-xs">
                      {formatDate(post.publishedAt || post.createdAt)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-dark-900 mb-2 group-hover:text-primary-600 transition-colors line-clamp-2">
                    {post.title}
                  </h3>

                  {/* Summary */}
                  <p className="text-dark-500 text-sm leading-relaxed mb-4 line-clamp-2">
                    {post.summary}
                  </p>

                  {/* Read more */}
                  <div className="flex items-center justify-between">
                    <span className="text-primary-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all duration-300">
                      Read More
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                    {post.authorName && (
                      <span className="text-dark-400 text-xs">
                        By {post.authorName}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
