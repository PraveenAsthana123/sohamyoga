'use client';

import { useState, useEffect, useCallback } from 'react';
import { servicesApi, type Service } from '@/lib/api';
import AdminTable, { type Column } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { AdminFormInput, AdminFormTextarea, AdminFormSelect, AdminFormCheckbox } from '@/components/admin/AdminFormInput';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editItem, setEditItem] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    shortDescription: '',
    fullDescription: '',
    iconSvg: '',
    slug: '',
    category: '',
    features: '',
    sortOrder: 0,
    isActive: true,
    isFeatured: false,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await servicesApi.getAll();
      setServices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({
      title: '',
      shortDescription: '',
      fullDescription: '',
      iconSvg: '',
      slug: '',
      category: '',
      features: '',
      sortOrder: 0,
      isActive: true,
      isFeatured: false,
    });
    setEditItem(null);
    setShowForm(false);
  };

  const handleEdit = (service: Service) => {
    setEditItem(service);
    setForm({
      title: service.title,
      shortDescription: service.shortDescription,
      fullDescription: service.fullDescription,
      iconSvg: service.iconSvg,
      slug: service.slug,
      category: service.category,
      features: service.features,
      sortOrder: service.sortOrder,
      isActive: service.isActive,
      isFeatured: service.isFeatured,
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
        const updated = await servicesApi.update(editItem.id, form);
        setServices((prev) => prev.map((s) => (s.id === editItem.id ? updated : s)));
      } else {
        const created = await servicesApi.create(form);
        setServices((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await servicesApi.delete(deleteTarget.id);
      setServices((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    } finally {
      setDeleting(false);
    }
  };

  const categoryOptions = [
    { label: 'AI & Machine Learning', value: 'ai-ml' },
    { label: 'Cloud & Infrastructure', value: 'cloud' },
    { label: 'Data & Analytics', value: 'data' },
    { label: 'Software Development', value: 'development' },
    { label: 'Consulting', value: 'consulting' },
    { label: 'Other', value: 'other' },
  ];

  const columns: Column<Service>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (s) => <span className="font-medium text-dark-900">{s.title}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (s) => <span className="text-dark-600 capitalize">{s.category}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (s) => (
        <StatusBadge label={s.isActive ? 'Active' : 'Inactive'} variant={s.isActive ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'isFeatured',
      label: 'Featured',
      render: (s) => (
        s.isFeatured ? <StatusBadge label="Featured" variant="info" /> : <span className="text-dark-400">-</span>
      ),
    },
    {
      key: 'sortOrder',
      label: 'Order',
      sortable: true,
      className: 'text-center',
      render: (s) => <span className="text-dark-500">{s.sortOrder}</span>,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Services</h1>
          <p className="text-dark-500 mt-1">Manage your service offerings.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary text-sm py-2 px-4"
        >
          + Add Service
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-800 font-medium">Dismiss</button>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-dark-900 mb-4">
            {editItem ? 'Edit Service' : 'Add New Service'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AdminFormInput label="Title" name="title" value={form.title} onChange={handleChange} required placeholder="Service title" />
              <AdminFormInput label="Slug" name="slug" value={form.slug} onChange={handleChange} required placeholder="service-slug" />
              <AdminFormSelect label="Category" name="category" value={form.category} onChange={handleChange} required placeholder="Select category" options={categoryOptions} />
              <AdminFormInput label="Sort Order" name="sortOrder" type="number" value={form.sortOrder} onChange={handleChange} />
              <AdminFormTextarea label="Short Description" name="shortDescription" value={form.shortDescription} onChange={handleChange} required rows={2} className="lg:col-span-2" />
              <AdminFormTextarea label="Full Description" name="fullDescription" value={form.fullDescription} onChange={handleChange} required rows={4} className="lg:col-span-2" />
              <AdminFormTextarea label="Features (JSON array or comma-separated)" name="features" value={form.features} onChange={handleChange} rows={3} className="lg:col-span-2" />
              <AdminFormTextarea label="Icon SVG" name="iconSvg" value={form.iconSvg} onChange={handleChange} rows={2} placeholder="<svg>...</svg>" className="lg:col-span-2" />
              <div className="flex items-center gap-6">
                <AdminFormCheckbox label="Active" name="isActive" checked={form.isActive} onChange={handleChange} />
                <AdminFormCheckbox label="Featured" name="isFeatured" checked={form.isFeatured} onChange={handleChange} />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-dark-200">
              <button type="submit" disabled={saving} className="btn-primary py-2 px-6 disabled:opacity-50">
                {saving ? 'Saving...' : editItem ? 'Update Service' : 'Create Service'}
              </button>
              <button type="button" onClick={resetForm} className="px-6 py-2 text-sm font-medium text-dark-700 bg-dark-100 rounded-lg hover:bg-dark-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <AdminTable<Service>
        columns={columns}
        data={services}
        keyField="id"
        loading={loading}
        emptyMessage="No services found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search services..."
        actions={(row) => (
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => handleEdit(row)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">Edit</button>
            <button onClick={() => setDeleteTarget(row)} className="text-sm text-red-600 hover:text-red-700 font-medium">Delete</button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Service"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
