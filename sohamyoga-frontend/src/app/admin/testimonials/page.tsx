'use client';

import { useState, useEffect, useCallback } from 'react';
import { testimonialsApi, type Testimonial } from '@/lib/api';
import AdminTable, { type Column } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { AdminFormInput, AdminFormTextarea, AdminFormCheckbox } from '@/components/admin/AdminFormInput';

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Testimonial | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editItem, setEditItem] = useState<Testimonial | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    authorName: '',
    authorTitle: '',
    company: '',
    quote: '',
    initials: '',
    rating: 5,
    isActive: true,
    sortOrder: 0,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await testimonialsApi.getAll();
      setTestimonials(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({ authorName: '', authorTitle: '', company: '', quote: '', initials: '', rating: 5, isActive: true, sortOrder: 0 });
    setEditItem(null);
    setShowForm(false);
  };

  const handleEdit = (t: Testimonial) => {
    setEditItem(t);
    setForm({
      authorName: t.authorName,
      authorTitle: t.authorTitle,
      company: t.company,
      quote: t.quote,
      initials: t.initials,
      rating: t.rating,
      isActive: t.isActive,
      sortOrder: t.sortOrder,
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
      if (editItem) {
        const updated = await testimonialsApi.update(editItem.id, form);
        setTestimonials((prev) => prev.map((t) => (t.id === editItem.id ? updated : t)));
      } else {
        const created = await testimonialsApi.create(form);
        setTestimonials((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save testimonial');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await testimonialsApi.delete(deleteTarget.id);
      setTestimonials((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete testimonial');
    } finally {
      setDeleting(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-dark-200'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  const columns: Column<Testimonial>[] = [
    {
      key: 'authorName',
      label: 'Author',
      sortable: true,
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">
            {t.initials}
          </div>
          <div>
            <p className="font-medium text-dark-900">{t.authorName}</p>
            <p className="text-xs text-dark-400">{t.authorTitle}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      sortable: true,
      render: (t) => <span className="text-dark-600">{t.company}</span>,
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (t) => renderStars(t.rating),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (t) => (
        <StatusBadge label={t.isActive ? 'Active' : 'Inactive'} variant={t.isActive ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'sortOrder',
      label: 'Order',
      sortable: true,
      className: 'text-center',
      render: (t) => <span className="text-dark-500">{t.sortOrder}</span>,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Testimonials</h1>
          <p className="text-dark-500 mt-1">Manage client testimonials.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm py-2 px-4">
          + Add Testimonial
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
            {editItem ? 'Edit Testimonial' : 'Add New Testimonial'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AdminFormInput label="Author Name" name="authorName" value={form.authorName} onChange={handleChange} required />
              <AdminFormInput label="Author Title" name="authorTitle" value={form.authorTitle} onChange={handleChange} required placeholder="e.g., CTO" />
              <AdminFormInput label="Company" name="company" value={form.company} onChange={handleChange} required />
              <AdminFormInput label="Initials" name="initials" value={form.initials} onChange={handleChange} required placeholder="e.g., JS" />
              <AdminFormInput label="Rating" name="rating" type="number" value={form.rating} onChange={handleChange} />
              <AdminFormInput label="Sort Order" name="sortOrder" type="number" value={form.sortOrder} onChange={handleChange} />
              <AdminFormTextarea label="Quote" name="quote" value={form.quote} onChange={handleChange} required rows={4} className="lg:col-span-2" />
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

      <AdminTable<Testimonial>
        columns={columns}
        data={testimonials}
        keyField="id"
        loading={loading}
        emptyMessage="No testimonials found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search testimonials..."
        actions={(row) => (
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => handleEdit(row)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">Edit</button>
            <button onClick={() => setDeleteTarget(row)} className="text-sm text-red-600 hover:text-red-700 font-medium">Delete</button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Testimonial"
        message={`Are you sure you want to delete the testimonial from "${deleteTarget?.authorName}"?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
