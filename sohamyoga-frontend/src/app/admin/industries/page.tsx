'use client';

import { useState, useEffect, useCallback } from 'react';
import { industriesApi, type IndustrySolution } from '@/lib/api';
import AdminTable, { type Column } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { AdminFormInput, AdminFormTextarea, AdminFormCheckbox } from '@/components/admin/AdminFormInput';

export default function IndustriesPage() {
  const [industries, setIndustries] = useState<IndustrySolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<IndustrySolution | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editItem, setEditItem] = useState<IndustrySolution | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    shortDescription: '',
    fullDescription: '',
    challenges: '',
    solutions: '',
    iconSvg: '',
    sortOrder: 0,
    isActive: true,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await industriesApi.getAll();
      setIndustries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load industries');
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
      slug: '',
      shortDescription: '',
      fullDescription: '',
      challenges: '',
      solutions: '',
      iconSvg: '',
      sortOrder: 0,
      isActive: true,
    });
    setEditItem(null);
    setShowForm(false);
  };

  const handleEdit = (industry: IndustrySolution) => {
    setEditItem(industry);
    setForm({
      title: industry.title,
      slug: industry.slug,
      shortDescription: industry.shortDescription,
      fullDescription: industry.fullDescription,
      challenges: industry.challenges,
      solutions: industry.solutions,
      iconSvg: industry.iconSvg,
      sortOrder: industry.sortOrder,
      isActive: industry.isActive,
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
        const updated = await industriesApi.update(editItem.id, form);
        setIndustries((prev) => prev.map((i) => (i.id === editItem.id ? updated : i)));
      } else {
        const created = await industriesApi.create(form);
        setIndustries((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save industry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await industriesApi.delete(deleteTarget.id);
      setIndustries((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete industry');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<IndustrySolution>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (i) => <span className="font-medium text-dark-900">{i.title}</span>,
    },
    {
      key: 'slug',
      label: 'Slug',
      sortable: true,
      render: (i) => <span className="text-dark-600">{i.slug}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (i) => (
        <StatusBadge label={i.isActive ? 'Active' : 'Inactive'} variant={i.isActive ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'sortOrder',
      label: 'Order',
      sortable: true,
      className: 'text-center',
      render: (i) => <span className="text-dark-500">{i.sortOrder}</span>,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Industries</h1>
          <p className="text-dark-500 mt-1">Manage industry solutions and verticals.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary text-sm py-2 px-4"
        >
          + Add Industry
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
            {editItem ? 'Edit Industry' : 'Add New Industry'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AdminFormInput label="Title" name="title" value={form.title} onChange={handleChange} required placeholder="Industry title" />
              <AdminFormInput label="Slug" name="slug" value={form.slug} onChange={handleChange} required placeholder="industry-slug" />
              <AdminFormInput label="Sort Order" name="sortOrder" type="number" value={form.sortOrder} onChange={handleChange} />
              <div className="flex items-center">
                <AdminFormCheckbox label="Active" name="isActive" checked={form.isActive} onChange={handleChange} />
              </div>
              <AdminFormTextarea label="Short Description" name="shortDescription" value={form.shortDescription} onChange={handleChange} required rows={2} className="lg:col-span-2" />
              <AdminFormTextarea label="Full Description" name="fullDescription" value={form.fullDescription} onChange={handleChange} required rows={4} className="lg:col-span-2" />
              <AdminFormTextarea label="Challenges" name="challenges" value={form.challenges} onChange={handleChange} rows={3} className="lg:col-span-2" placeholder="Key challenges in this industry..." />
              <AdminFormTextarea label="Solutions" name="solutions" value={form.solutions} onChange={handleChange} rows={3} className="lg:col-span-2" placeholder="Solutions offered for this industry..." />
              <AdminFormTextarea label="Icon SVG" name="iconSvg" value={form.iconSvg} onChange={handleChange} rows={2} placeholder="<svg>...</svg>" className="lg:col-span-2" />
            </div>
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-dark-200">
              <button type="submit" disabled={saving} className="btn-primary py-2 px-6 disabled:opacity-50">
                {saving ? 'Saving...' : editItem ? 'Update Industry' : 'Create Industry'}
              </button>
              <button type="button" onClick={resetForm} className="px-6 py-2 text-sm font-medium text-dark-700 bg-dark-100 rounded-lg hover:bg-dark-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <AdminTable<IndustrySolution>
        columns={columns}
        data={industries}
        keyField="id"
        loading={loading}
        emptyMessage="No industries found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search industries..."
        actions={(row) => (
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => handleEdit(row)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">Edit</button>
            <button onClick={() => setDeleteTarget(row)} className="text-sm text-red-600 hover:text-red-700 font-medium">Delete</button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Industry"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
