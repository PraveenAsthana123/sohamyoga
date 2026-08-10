'use client';

import { useState, useEffect, useCallback } from 'react';
import { usersApi, type AdminUser } from '@/lib/api';
import AdminTable, { type Column } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { AdminFormInput, AdminFormSelect } from '@/components/admin/AdminFormInput';

const AVAILABLE_ROLES = ['Admin', 'Editor', 'HR', 'Sales'];

const ROLE_COLORS: Record<string, 'danger' | 'info' | 'success' | 'warning'> = {
  Admin: 'danger',
  Editor: 'info',
  HR: 'success',
  Sales: 'warning',
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Create user modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: '' });
  const [creating, setCreating] = useState(false);

  // Edit roles modal
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await usersApi.getAll();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create user handlers
  const handleCreateChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await usersApi.create(createForm);
      setShowCreateModal(false);
      setCreateForm({ email: '', password: '', role: '' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  // Edit roles handlers
  const openEditRoles = (user: AdminUser) => {
    setEditTarget(user);
    setEditRoles([...user.roles]);
  };

  const toggleRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSaveRoles = async () => {
    if (!editTarget || editRoles.length === 0) return;
    setError('');
    setSavingRoles(true);
    try {
      await usersApi.updateRoles(editTarget.id, editRoles);
      setEditTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update roles');
    } finally {
      setSavingRoles(false);
    }
  };

  // Delete handlers
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError('');
    setDeleting(true);
    try {
      await usersApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold">
            {u.email.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-dark-900">{u.email}</span>
        </div>
      ),
    },
    {
      key: 'roles',
      label: 'Roles',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((role) => (
            <StatusBadge key={role} label={role} variant={ROLE_COLORS[role] || 'neutral'} />
          ))}
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (u) => (
        <span className="text-dark-500 text-sm">
          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '--'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">User Management</h1>
          <p className="text-dark-500 mt-1">Manage admin users and their roles.</p>
        </div>
        <button
          onClick={() => {
            setCreateForm({ email: '', password: '', role: '' });
            setShowCreateModal(true);
          }}
          className="btn-primary text-sm py-2 px-4"
        >
          + Create User
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-800 font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Roles Legend */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h3 className="text-sm font-semibold text-dark-700 mb-2">Role Legend</h3>
        <div className="flex flex-wrap gap-3">
          {AVAILABLE_ROLES.map((role) => (
            <StatusBadge key={role} label={role} variant={ROLE_COLORS[role] || 'neutral'} />
          ))}
        </div>
      </div>

      <AdminTable<AdminUser>
        columns={columns}
        data={users}
        keyField="id"
        loading={loading}
        emptyMessage="No users found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users by email..."
        actions={(row) => (
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => openEditRoles(row)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Edit Roles
            </button>
            <button
              onClick={() => setDeleteTarget(row)}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Delete
            </button>
          </div>
        )}
      />

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-dark-900 mb-4">Create New User</h3>
            <form onSubmit={handleCreateSubmit}>
              <div className="space-y-4">
                <AdminFormInput
                  label="Email"
                  name="email"
                  type="email"
                  value={createForm.email}
                  onChange={handleCreateChange}
                  required
                  placeholder="user@example.com"
                />
                <AdminFormInput
                  label="Password"
                  name="password"
                  type="password"
                  value={createForm.password}
                  onChange={handleCreateChange}
                  required
                  placeholder="Min 8 chars, uppercase, lowercase, digit, special"
                />
                <AdminFormSelect
                  label="Role"
                  name="role"
                  value={createForm.role}
                  onChange={handleCreateChange}
                  required
                  placeholder="Select a role..."
                  options={AVAILABLE_ROLES.map((r) => ({ label: r, value: r }))}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-dark-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-dark-700 bg-dark-100 rounded-lg hover:bg-dark-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary py-2 px-6 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Roles Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditTarget(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-dark-900 mb-2">Edit Roles</h3>
            <p className="text-sm text-dark-500 mb-4">
              Update roles for <span className="font-medium text-dark-700">{editTarget.email}</span>
            </p>
            <div className="space-y-3 mb-6">
              {AVAILABLE_ROLES.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-3 p-3 rounded-lg border border-dark-200 hover:bg-dark-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={editRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="h-4 w-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex items-center gap-2">
                    <StatusBadge label={role} variant={ROLE_COLORS[role] || 'neutral'} />
                  </div>
                </label>
              ))}
            </div>
            {editRoles.length === 0 && (
              <p className="text-sm text-red-600 mb-4">At least one role must be selected.</p>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-dark-200">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-sm font-medium text-dark-700 bg-dark-100 rounded-lg hover:bg-dark-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoles}
                disabled={savingRoles || editRoles.length === 0}
                className="btn-primary py-2 px-6 disabled:opacity-50"
              >
                {savingRoles ? 'Saving...' : 'Save Roles'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete User"
        message={`Are you sure you want to delete "${deleteTarget?.email}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
