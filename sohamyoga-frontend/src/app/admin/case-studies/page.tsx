'use client';

import { useState, useEffect, useCallback } from 'react';
import { caseStudiesApi, type CaseStudy } from '@/lib/api';
import AdminTable, { type Column } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { AdminFormInput, AdminFormTextarea, AdminFormCheckbox } from '@/components/admin/AdminFormInput';

export default function CaseStudiesPage() {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CaseStudy | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editItem, setEditItem] = useState<CaseStudy | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    fullContent: '',
    tag: '',
    gradientFrom: '#3b82f6',
    gradientTo: '#8b5cf6',
    iconSvg: '',
    isActive: true,
    sortOrder: 0,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await caseStudiesApi.getAll();
      setCaseStudies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case studies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({ title: '', slug: '', description: '', fullContent: '', tag: '', gradientFrom: '#3b82f6', gradientTo: '#8b5cf6', iconSvg: '', isActive: true, sortOrder: 0 });
    setEditItem(null);
    setShowForm(false);
  };

  const handleEdit = (cs: CaseStudy) => {
    setEditItem(cs);
    setForm({
      title: cs.title,
      slug: cs.slug,
      description: cs.description,
      fullContent: cs.fullContent,
      tag: cs.tag,
      gradientFrom: cs.gradientFrom,
      gradientTo: cs.gradientTo,
      iconSvg: cs.iconSvg,
      isActive: cs.isActive,
      sortOrder: cs.sortOrder,
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

  const generateSlug = () => {
    const slug = form.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setForm((prev) => ({ ...prev, slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editItem) {
        const updated = await caseStudiesApi.update(editItem.id, form);
        setCaseStudies((prev) => prev.map((cs) => (cs.id === editItem.id ? updated : cs)));
      } else {
        const created = await caseStudiesApi.create(form);
        setCaseStudies((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save case study');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await caseStudiesApi.delete(deleteTarget.id);
      setCaseStudies((prev) => prev.filter((cs) => cs.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete case study');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<CaseStudy>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (cs) => (
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-semibold"
            style={{ background: `linear-gradient(135deg, ${cs.gradientFrom}, ${cs.gradientTo})` }}
          >
            {cs.title.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-dark-900">{cs.title}</p>
            <p className="text-xs text-dark-400">{cs.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'tag',
      label: 'Tag',
      sortable: true,
      render: (cs) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700">
          {cs.tag}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (cs) => (
        <span className="text-dark-600 text-sm line-clamp-2">{cs.description}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (cs) => (
        <StatusBadge label={cs.isActive ? 'Active' : 'Inactive'} variant={cs.isActive ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'sortOrder',
      label: 'Order',
      sortable: true,
      className: 'text-center',
      render: (cs) => <span className="text-dark-500">{cs.sortOrder}</span>,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Case Studies</h1>
          <p className="text-dark-500 mt-1">Manage client case studies.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm py-2 px-4">
          + Add Case Study
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
            {editItem ? 'Edit Case Study' : 'Add New Case Study'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AdminFormInput label="Title" name="title" value={form.title} onChange={handleChange} required />
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <AdminFormInput label="Slug" name="slug" value={form.slug} onChange={handleChange} required placeholder="auto-generated-slug" />
                </div>
                <button type="button" onClick={generateSlug} className="px-3 py-2 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors mb-0.5">
                  Generate
                </button>
              </div>
              <AdminFormInput label="Tag" name="tag" value={form.tag} onChange={handleChange} required placeholder="e.g., Healthcare" />
              <AdminFormInput label="Sort Order" name="sortOrder" type="number" value={form.sortOrder} onChange={handleChange} />
              <AdminFormInput label="Gradient From" name="gradientFrom" type="color" value={form.gradientFrom} onChange={handleChange} />
              <AdminFormInput label="Gradient To" name="gradientTo" type="color" value={form.gradientTo} onChange={handleChange} />
              <AdminFormTextarea label="Description" name="description" value={form.description} onChange={handleChange} required rows={3} className="lg:col-span-2" />
              <AdminFormTextarea label="Full Content" name="fullContent" value={form.fullContent} onChange={handleChange} rows={6} className="lg:col-span-2" />
              <AdminFormTextarea label="Icon SVG" name="iconSvg" value={form.iconSvg} onChange={handleChange} rows={3} className="lg:col-span-2" placeholder="<svg>...</svg>" />
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

      <AdminTable<CaseStudy>
        columns={columns}
        data={caseStudies}
        keyField="id"
        loading={loading}
        emptyMessage="No case studies found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search case studies..."
        actions={(row) => (
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => handleEdit(row)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">Edit</button>
            <button onClick={() => setDeleteTarget(row)} className="text-sm text-red-600 hover:text-red-700 font-medium">Delete</button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Case Study"
        message={`Are you sure you want to delete the case study "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
