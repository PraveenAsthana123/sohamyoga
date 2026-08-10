'use client';

import { useState, useEffect, useCallback } from 'react';
import { teamApi, type TeamMember } from '@/lib/api';
import AdminTable, { type Column } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { AdminFormInput, AdminFormTextarea, AdminFormCheckbox } from '@/components/admin/AdminFormInput';

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editItem, setEditItem] = useState<TeamMember | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    title: '',
    bio: '',
    imageUrl: '',
    sortOrder: 0,
    isActive: true,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await teamApi.getAll();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({ name: '', title: '', bio: '', imageUrl: '', sortOrder: 0, isActive: true });
    setEditItem(null);
    setShowForm(false);
  };

  const handleEdit = (m: TeamMember) => {
    setEditItem(m);
    setForm({
      name: m.name,
      title: m.title,
      bio: m.bio,
      imageUrl: m.imageUrl || '',
      sortOrder: m.sortOrder,
      isActive: m.isActive,
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
      const payload = { ...form, imageUrl: form.imageUrl || undefined };
      if (editItem) {
        const updated = await teamApi.update(editItem.id, payload);
        setMembers((prev) => prev.map((m) => (m.id === editItem.id ? updated : m)));
      } else {
        const created = await teamApi.create(payload);
        setMembers((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team member');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await teamApi.delete(deleteTarget.id);
      setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team member');
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const columns: Column<TeamMember>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (m) => (
        <div className="flex items-center gap-3">
          {m.imageUrl ? (
            <img src={m.imageUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
              {getInitials(m.name)}
            </div>
          )}
          <div>
            <p className="font-medium text-dark-900">{m.name}</p>
            <p className="text-xs text-dark-400">{m.title}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'title',
      label: 'Role',
      render: (m) => <span className="text-dark-600">{m.title}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (m) => (
        <StatusBadge label={m.isActive ? 'Active' : 'Inactive'} variant={m.isActive ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'sortOrder',
      label: 'Order',
      sortable: true,
      className: 'text-center',
      render: (m) => <span className="text-dark-500">{m.sortOrder}</span>,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Team Members</h1>
          <p className="text-dark-500 mt-1">Manage your team.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm py-2 px-4">
          + Add Member
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
            {editItem ? 'Edit Team Member' : 'Add New Team Member'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AdminFormInput label="Name" name="name" value={form.name} onChange={handleChange} required />
              <AdminFormInput label="Title / Role" name="title" value={form.title} onChange={handleChange} required placeholder="e.g., CEO, Lead Developer" />
              <AdminFormInput label="Image URL" name="imageUrl" type="url" value={form.imageUrl} onChange={handleChange} placeholder="https://example.com/photo.jpg" />
              <AdminFormInput label="Sort Order" name="sortOrder" type="number" value={form.sortOrder} onChange={handleChange} />
              <AdminFormTextarea label="Bio" name="bio" value={form.bio} onChange={handleChange} required rows={4} className="lg:col-span-2" />
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

      <AdminTable<TeamMember>
        columns={columns}
        data={members}
        keyField="id"
        loading={loading}
        emptyMessage="No team members found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search team..."
        actions={(row) => (
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => handleEdit(row)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">Edit</button>
            <button onClick={() => setDeleteTarget(row)} className="text-sm text-red-600 hover:text-red-700 font-medium">Delete</button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Team Member"
        message={`Are you sure you want to remove "${deleteTarget?.name}" from the team?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
