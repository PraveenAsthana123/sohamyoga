'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { blogApi, type BlogPost, type BlogCategory } from '@/lib/api';
import { AdminFormInput, AdminFormTextarea, AdminFormSelect, AdminFormCheckbox } from '@/components/admin/AdminFormInput';

export default function EditBlogPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = Number(params.id);

  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    categoryId: '',
    summary: '',
    content: '',
    tags: '',
    featuredImageUrl: '',
    isPublished: false,
    authorName: '',
    metaTitle: '',
    metaDescription: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, postsData] = await Promise.all([
          blogApi.getCategories(),
          blogApi.getPosts({ page: 1, pageSize: 1000 }),
        ]);
        setCategories(categoriesData);

        // Find the post by ID
        const post = postsData.posts.find((p: BlogPost) => p.id === postId);
        if (!post) {
          setError('Post not found');
          return;
        }

        setForm({
          title: post.title,
          categoryId: String(post.categoryId),
          summary: post.summary,
          content: post.content,
          tags: post.tags || '',
          featuredImageUrl: post.featuredImageUrl || '',
          isPublished: post.isPublished,
          authorName: post.authorName,
          metaTitle: post.metaTitle || '',
          metaDescription: post.metaDescription || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [postId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await blogApi.update(postId, {
        title: form.title,
        categoryId: Number(form.categoryId),
        summary: form.summary,
        content: form.content,
        tags: form.tags,
        featuredImageUrl: form.featuredImageUrl || undefined,
        isPublished: form.isPublished,
        authorName: form.authorName,
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
      });
      router.push('/admin/blog');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-dark-500">Loading post...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Edit Post</h1>
          <p className="text-dark-500 mt-1">Update the blog post details.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AdminFormInput
            label="Title"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            placeholder="Enter post title"
            className="lg:col-span-2"
          />

          <AdminFormSelect
            label="Category"
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            required
            placeholder="Select a category"
            options={categories.map((cat) => ({ label: cat.name, value: cat.id }))}
          />

          <AdminFormInput
            label="Author Name"
            name="authorName"
            value={form.authorName}
            onChange={handleChange}
            required
            placeholder="Author name"
          />

          <AdminFormTextarea
            label="Summary"
            name="summary"
            value={form.summary}
            onChange={handleChange}
            required
            rows={3}
            placeholder="Brief summary of the post"
            className="lg:col-span-2"
          />

          <AdminFormTextarea
            label="Content"
            name="content"
            value={form.content}
            onChange={handleChange}
            required
            rows={16}
            placeholder="Write your blog post content here..."
            className="lg:col-span-2"
          />

          <AdminFormInput
            label="Tags"
            name="tags"
            value={form.tags}
            onChange={handleChange}
            placeholder="Comma-separated tags"
            className="lg:col-span-2"
          />

          <AdminFormInput
            label="Featured Image URL"
            name="featuredImageUrl"
            type="url"
            value={form.featuredImageUrl}
            onChange={handleChange}
            placeholder="https://example.com/image.jpg"
            className="lg:col-span-2"
          />

          <AdminFormInput
            label="Meta Title (SEO)"
            name="metaTitle"
            value={form.metaTitle}
            onChange={handleChange}
            placeholder="SEO title (optional)"
          />

          <AdminFormInput
            label="Meta Description (SEO)"
            name="metaDescription"
            value={form.metaDescription}
            onChange={handleChange}
            placeholder="SEO description (optional)"
          />

          <div className="lg:col-span-2">
            <AdminFormCheckbox
              label="Published"
              name="isPublished"
              checked={form.isPublished}
              onChange={handleChange}
              description="If unchecked, the post will be saved as a draft."
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-8 pt-6 border-t border-dark-200">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary py-2 px-6 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Update Post'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/blog')}
            className="px-6 py-2 text-sm font-medium text-dark-700 bg-dark-100 rounded-lg hover:bg-dark-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
