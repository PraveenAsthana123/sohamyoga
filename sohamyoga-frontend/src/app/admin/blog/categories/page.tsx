'use client';

import { useState, useEffect, useCallback } from 'react';
import { blogCategoryApi, blogApi } from '@/lib/api';
import type { BlogCategory } from '@/lib/api';
import AdminTable from '@/components/admin/AdminTable';
import type { Column } from '@/components/admin/AdminTable';
import ConfirmModal from '@/components/admin/ConfirmModal';

interface CategoryWithCount extends BlogCategory {
  postCount?: number;
}

export default function BlogCategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const cats = await blogCategoryApi.getAll();
      setCategories(cats);
    } catch {
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      slug: editingId ? prev.slug : generateSlug(name),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      setError('Name and slug are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await blogCategoryApi.update(editingId, form);
      } else {
        await blogCategoryApi.create(form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', slug: '', description: '' });
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat: CategoryWithCount) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, slug: cat.slug, description: cat.description || '' });
    setShowForm(true);
    setError('');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await blogCategoryApi.delete(deleteId);
      setDeleteId(null);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
      setDeleteId(null);
    }
  };

  const columns: Column<CategoryWithCount>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'slug', label: 'Slug', sortable: true },
    {
      key: 'postCount',
      label: 'Posts',
      sortable: true,
      render: (cat) => <span className="text-dark-500">{cat.postCount ?? '-'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Blog Categories</h1>
          <p className="text-dark-500 mt-1">Manage blog post categories</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError('')} className="float-right font-bold">&times;</button>
        </div>
      )}

      {/* Inline Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-dark-200">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Category' : 'New Category'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 border border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Category name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                className="w-full px-3 py-2 border border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="category-slug"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Optional description"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2 px-4">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: '', slug: '', description: '' }); }}
              className="px-4 py-2 text-sm border border-dark-300 rounded-lg hover:bg-dark-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <AdminTable
        columns={columns}
        data={categories}
        keyField="id"
        loading={loading}
        emptyMessage="No categories found."
        headerActions={
          !showForm ? (
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', slug: '', description: '' }); setError(''); }} className="btn-primary text-sm py-2 px-4">
              + Add Category
            </button>
          ) : undefined
        }
        actions={(cat) => (
          <div className="flex gap-2 justify-end">
            <button onClick={() => handleEdit(cat)} className="text-primary-600 hover:text-primary-800 text-sm font-medium">
              Edit
            </button>
            <button onClick={() => setDeleteId(cat.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">
              Delete
            </button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={deleteId !== null}
        title="Delete Category"
        message="Are you sure you want to delete this category? Categories with posts cannot be deleted."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
