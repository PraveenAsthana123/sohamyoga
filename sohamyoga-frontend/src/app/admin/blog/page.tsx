'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { blogApi, type BlogPost, type BlogCategory } from '@/lib/api';
import AdminTable, { type Column } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmModal from '@/components/admin/ConfirmModal';

export default function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [postsData, categoriesData] = await Promise.all([
        blogApi.getPosts({ search: search || undefined, categoryId: categoryFilter }),
        blogApi.getCategories(),
      ]);
      setPosts(postsData.posts);
      setCategories(categoriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await blogApi.delete(deleteTarget.id);
      setPosts(posts.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const columns: Column<BlogPost>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (post) => (
        <div>
          <p className="font-medium text-dark-900">{post.title}</p>
          <p className="text-xs text-dark-400 mt-0.5">/{post.slug}</p>
        </div>
      ),
    },
    {
      key: 'categoryId',
      label: 'Category',
      render: (post) => {
        const cat = categories.find((c) => c.id === post.categoryId);
        return <span className="text-dark-600">{cat?.name || 'Uncategorized'}</span>;
      },
    },
    {
      key: 'isPublished',
      label: 'Status',
      render: (post) => (
        <StatusBadge
          label={post.isPublished ? 'Published' : 'Draft'}
          variant={post.isPublished ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (post) => <span className="text-dark-500">{formatDate(post.createdAt)}</span>,
    },
    {
      key: 'viewCount',
      label: 'Views',
      sortable: true,
      className: 'text-center',
      render: (post) => <span className="text-dark-500">{post.viewCount}</span>,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Blog Posts</h1>
          <p className="text-dark-500 mt-1">Manage your blog content.</p>
        </div>
        <Link href="/admin/blog/new" className="btn-primary text-sm py-2 px-4">
          + Create New Post
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-800 font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={categoryFilter || ''}
          onChange={(e) => setCategoryFilter(e.target.value ? Number(e.target.value) : undefined)}
          className="px-4 py-2 border border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <AdminTable<BlogPost>
        columns={columns}
        data={posts}
        keyField="id"
        loading={loading}
        emptyMessage="No blog posts found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search posts..."
        actions={(post) => (
          <div className="flex items-center gap-2 justify-end">
            <Link
              href={`/admin/blog/edit/${post.id}`}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Edit
            </Link>
            <button
              onClick={() => setDeleteTarget(post)}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Delete
            </button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Blog Post"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
