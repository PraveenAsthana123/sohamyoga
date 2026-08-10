'use client';

import { useState, useEffect, useCallback } from 'react';
import { videosApi, type VideoDemo } from '@/lib/api';
import AdminTable, { type Column } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { AdminFormInput, AdminFormTextarea, AdminFormSelect, AdminFormCheckbox } from '@/components/admin/AdminFormInput';

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoDemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VideoDemo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editItem, setEditItem] = useState<VideoDemo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    videoUrl: '',
    thumbnailUrl: '',
    duration: '',
    category: '',
    isActive: true,
    sortOrder: 0,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await videosApi.getAll();
      setVideos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({ title: '', description: '', videoUrl: '', thumbnailUrl: '', duration: '', category: '', isActive: true, sortOrder: 0 });
    setEditItem(null);
    setShowForm(false);
  };

  const handleEdit = (v: VideoDemo) => {
    setEditItem(v);
    setForm({
      title: v.title,
      description: v.description,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl || '',
      duration: v.duration,
      category: v.category,
      isActive: v.isActive,
      sortOrder: v.sortOrder,
    });
    setShowForm(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : type === 'number'
        ? Number(value)
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        thumbnailUrl: form.thumbnailUrl || undefined,
      };
      if (editItem) {
        const updated = await videosApi.update(editItem.id, payload);
        setVideos((prev) => prev.map((v) => (v.id === editItem.id ? updated : v)));
      } else {
        const created = await videosApi.create(payload);
        setVideos((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save video');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await videosApi.delete(deleteTarget.id);
      setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete video');
    } finally {
      setDeleting(false);
    }
  };

  const categoryOptions = [
    { label: 'Product Demo', value: 'product-demo' },
    { label: 'Tutorial', value: 'tutorial' },
    { label: 'Webinar', value: 'webinar' },
    { label: 'Case Study', value: 'case-study' },
    { label: 'Other', value: 'other' },
  ];

  const columns: Column<VideoDemo>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (v) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-dark-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-dark-900">{v.title}</p>
            <p className="text-xs text-dark-400">{v.duration}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (v) => <span className="text-dark-600 capitalize">{v.category.replace('-', ' ')}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (v) => (
        <StatusBadge label={v.isActive ? 'Active' : 'Inactive'} variant={v.isActive ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'sortOrder',
      label: 'Order',
      sortable: true,
      className: 'text-center',
      render: (v) => <span className="text-dark-500">{v.sortOrder}</span>,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Videos</h1>
          <p className="text-dark-500 mt-1">Manage video demos and tutorials.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm py-2 px-4">
          + Add Video
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-800 font-medium">Dismiss</button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4">
            {editItem ? 'Edit Video' : 'Add New Video'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AdminFormInput label="Title" name="title" value={form.title} onChange={handleChange} required />
              <AdminFormSelect label="Category" name="category" value={form.category} onChange={handleChange} required placeholder="Select category" options={categoryOptions} />
              <AdminFormInput label="Video URL" name="videoUrl" type="url" value={form.videoUrl} onChange={handleChange} required placeholder="https://youtube.com/..." />
              <AdminFormInput label="Thumbnail URL" name="thumbnailUrl" type="url" value={form.thumbnailUrl} onChange={handleChange} placeholder="https://example.com/thumb.jpg" />
              <AdminFormInput label="Duration" name="duration" value={form.duration} onChange={handleChange} required placeholder="e.g., 5:30" />
              <AdminFormInput label="Sort Order" name="sortOrder" type="number" value={form.sortOrder} onChange={handleChange} />
              <AdminFormTextarea label="Description" name="description" value={form.description} onChange={handleChange} required rows={3} className="lg:col-span-2" />
              <AdminFormCheckbox label="Active" name="isActive" checked={form.isActive} onChange={handleChange} />
            </div>
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-dark-200">
              <button type="submit" disabled={saving} className="btn-primary py-2 px-6 disabled:opacity-50">
                {saving ? 'Saving...' : editItem ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className="px-6 py-2 text-sm font-medium text-dark-700 bg-dark-100 rounded-lg hover:bg-dark-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <AdminTable<VideoDemo>
        columns={columns}
        data={videos}
        keyField="id"
        loading={loading}
        emptyMessage="No videos found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search videos..."
        actions={(row) => (
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => handleEdit(row)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">Edit</button>
            <button onClick={() => setDeleteTarget(row)} className="text-sm text-red-600 hover:text-red-700 font-medium">Delete</button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Video"
        message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
