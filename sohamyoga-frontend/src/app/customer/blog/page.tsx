'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { blogApi, BlogPost, BlogCategory } from '@/lib/api';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/customer/blog/${post.slug}`}
      className="group block bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all overflow-hidden"
    >
      {post.featuredImageUrl ? (
        <img
          src={post.featuredImageUrl}
          alt={post.title}
          className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-44 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <span className="text-4xl">📄</span>
        </div>
      )}
      <div className="p-5">
        {post.category && (
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            {post.category.name}
          </span>
        )}
        <h3 className="mt-2 font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors">
          {post.title}
        </h3>
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{post.summary}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span>{post.authorName}</span>
          <span>{formatDate(post.publishedAt || post.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

function CustomerBlogInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get('page') ?? '1');
  const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')!) : undefined;
  const search = searchParams.get('search') ?? '';
  const pageSize = 9;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      blogApi.getPosts({ page, pageSize, categoryId, search: search || undefined }),
      blogApi.getCategories(),
    ])
      .then(([data, cats]) => {
        setPosts(data.posts);
        setTotal(data.total);
        setCategories(cats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, categoryId, search]);

  const setParam = (key: string, value: string | undefined) => {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete('page');
    router.push(`/customer/blog?${p.toString()}`);
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Blog & Resources</h1>
        <p className="text-gray-500 mt-1 text-sm">Insights on AI, IT solutions, and digital transformation.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search articles…"
          defaultValue={search}
          onKeyDown={(e) => { if (e.key === 'Enter') setParam('search', (e.target as HTMLInputElement).value || undefined); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-56"
        />
        <select
          value={categoryId ?? ''}
          onChange={(e) => setParam('categoryId', e.target.value || undefined)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {(search || categoryId) && (
          <button
            onClick={() => router.push('/customer/blog')}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">{search ? `No results for "${search}"` : 'No posts available yet.'}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => <BlogCard key={post.id} post={post} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => { const params = new URLSearchParams(searchParams.toString()); params.set('page', String(p)); router.push(`/customer/blog?${params}`); }}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-3">{total} article{total !== 1 ? 's' : ''} total</p>
        </>
      )}
    </div>
  );
}

export default function CustomerBlogPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>}>
      <CustomerBlogInner />
    </Suspense>
  );
}
