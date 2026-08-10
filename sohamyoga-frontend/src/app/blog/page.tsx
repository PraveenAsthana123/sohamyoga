import { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import type { BlogPost, BlogCategory } from '@/lib/api';
import BlogSearch from '@/components/blog/BlogSearch';
import Pagination from '@/components/blog/Pagination';
import { SERVER_API_URL as API_URL } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Blog - Insights & Articles',
  description: 'Explore the latest insights on AI, machine learning, IT solutions, and digital transformation from the SohamYoga team.',
  openGraph: {
    title: 'Blog - SohamYoga',
    description: 'Explore the latest insights on AI, machine learning, IT solutions, and digital transformation.',
  },
};

interface BlogPageProps {
  searchParams: { page?: string; categoryId?: string; search?: string; tag?: string };
}

async function getCategories(): Promise<BlogCategory[]> {
  try {
    const res = await fetch(`${API_URL}/api/blog/categories`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getBlogPosts(params: {
  page?: number;
  pageSize?: number;
  categoryId?: number;
  search?: string;
  tag?: string;
}): Promise<{ posts: BlogPost[]; total: number; page: number; pageSize: number }> {
  try {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    if (params.categoryId) searchParams.set('categoryId', params.categoryId.toString());
    if (params.search) searchParams.set('search', params.search);
    if (params.tag) searchParams.set('tag', params.tag);

    const queryString = searchParams.toString();
    const url = `${API_URL}/api/blog${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(url, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { posts: [], total: 0, page: 1, pageSize: 9 };
    return res.json();
  } catch {
    return { posts: [], total: 0, page: 1, pageSize: 9 };
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getGradient(index: number): string {
  const gradients = [
    'from-primary-600 via-primary-700 to-primary-900',
    'from-accent-600 via-accent-700 to-primary-800',
    'from-dark-700 via-primary-800 to-dark-900',
    'from-primary-800 via-accent-700 to-primary-600',
    'from-dark-800 via-dark-700 to-primary-900',
    'from-accent-700 via-primary-700 to-dark-800',
  ];
  return gradients[index % gradients.length];
}

function BlogPostCard({ post, index }: { post: BlogPost; index: number }) {
  return (
    <article className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-dark-100">
      {/* Featured Image / Gradient */}
      <div className={`relative h-52 bg-gradient-to-br ${getGradient(index)} overflow-hidden`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-32 h-32 bg-white rounded-full blur-2xl" />
          <div className="absolute bottom-4 left-4 w-24 h-24 bg-white rounded-full blur-2xl" />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 px-6">
          <svg className="w-10 h-10 mb-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <p className="text-sm font-medium text-center opacity-80 line-clamp-2">{post.title}</p>
        </div>
        {post.category && (
          <span className="absolute top-3 left-3 px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold rounded-full border border-white/20">
            {post.category.name}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex items-center gap-3 text-xs text-dark-400 mb-3">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(post.publishedAt || post.createdAt)}
          </span>
          <span className="text-dark-300">|</span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {post.authorName}
          </span>
        </div>

        <h2 className="text-lg font-bold text-dark-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h2>

        <p className="text-sm text-dark-500 mb-4 line-clamp-3 leading-relaxed">
          {post.summary}
        </p>

        <Link
          href={`/blog/${post.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors group/link"
        >
          Read More
          <svg className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </article>
  );
}

async function BlogContent({ searchParams }: BlogPageProps) {
  const page = parseInt(searchParams.page || '1', 10);
  const categoryId = searchParams.categoryId ? parseInt(searchParams.categoryId, 10) : undefined;
  const search = searchParams.search;
  const tag = searchParams.tag;

  const [data, categories] = await Promise.all([
    getBlogPosts({ page, pageSize: 9, categoryId, search, tag }),
    getCategories(),
  ]);

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <>
      <BlogSearch
        categories={categories}
        currentCategory={categoryId}
        currentSearch={search}
      />

      {data.posts.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-20 h-20 text-dark-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <h3 className="text-xl font-semibold text-dark-600 mb-2">No articles found</h3>
          <p className="text-dark-400">
            {search
              ? `No results for "${search}". Try a different search term.`
              : 'No blog posts available yet. Check back soon!'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {data.posts.map((post, idx) => (
              <BlogPostCard key={post.id} post={post} index={idx} />
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/blog"
          />
        </>
      )}
    </>
  );
}

export default function BlogPage({ searchParams }: BlogPageProps) {
  return (
    <>
      {/* Hero Section */}
      <section className="gradient-bg pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Insights & Articles
          </h1>
          <p className="text-lg text-primary-200 max-w-2xl mx-auto">
            Stay ahead with expert perspectives on AI, machine learning, cloud computing,
            and the latest in technology innovation.
          </p>
        </div>
      </section>

      {/* Blog Content */}
      <section className="py-16 bg-dark-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Suspense
            fallback={
              <div className="text-center py-20">
                <div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <p className="mt-4 text-dark-400">Loading articles...</p>
              </div>
            }
          >
            <BlogContent searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-dark-900 mb-4">
            Never Miss an Update
          </h2>
          <p className="text-dark-500 mb-8">
            Subscribe to our newsletter for the latest insights on AI, technology, and digital transformation.
          </p>
          <Link href="/contact" className="btn-primary">
            Subscribe to Newsletter
          </Link>
        </div>
      </section>
    </>
  );
}
