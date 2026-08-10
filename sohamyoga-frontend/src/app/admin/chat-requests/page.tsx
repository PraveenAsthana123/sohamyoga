'use client';

import { useState, useEffect, useCallback } from 'react';
import { chatRequestApi, type ChatRequest } from '@/lib/api';
import AdminTable, { type Column } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';

export default function ChatRequestsPage() {
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ChatRequest | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await chatRequestApi.getAll();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResolve = async (req: ChatRequest) => {
    setActionLoading(true);
    try {
      await chatRequestApi.resolve(req.id, resolveNotes);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id
            ? { ...r, isResolved: true, adminNotes: resolveNotes, resolvedAt: new Date().toISOString() }
            : r
        )
      );
      setSelectedRequest(null);
      setResolveNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async (req: ChatRequest) => {
    if (!assignTo.trim()) return;
    setActionLoading(true);
    try {
      await chatRequestApi.assign(req.id, assignTo);
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, assignedTo: assignTo } : r))
      );
      setAssignTo('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign request');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const priorityVariant = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'urgent':
        return 'danger';
      case 'medium':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const columns: Column<ChatRequest>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (req) => (
        <div>
          <p className="font-medium text-dark-900">{req.name}</p>
          <p className="text-xs text-dark-400">{req.email}</p>
        </div>
      ),
    },
    {
      key: 'requestType',
      label: 'Type',
      render: (req) => <span className="text-dark-600 capitalize">{req.requestType}</span>,
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (req) => (
        <StatusBadge
          label={req.priority || 'Normal'}
          variant={priorityVariant(req.priority)}
        />
      ),
    },
    {
      key: 'isResolved',
      label: 'Status',
      render: (req) => (
        <StatusBadge
          label={req.isResolved ? 'Resolved' : 'Pending'}
          variant={req.isResolved ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      render: (req) => (
        <span className="text-dark-500">{req.assignedTo || 'Unassigned'}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (req) => <span className="text-dark-500 text-xs">{formatDate(req.createdAt)}</span>,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Chat Requests</h1>
          <p className="text-dark-500 mt-1">Manage incoming chat and support requests.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-800 font-medium">Dismiss</button>
        </div>
      )}

      <AdminTable<ChatRequest>
        columns={columns}
        data={requests}
        keyField="id"
        loading={loading}
        emptyMessage="No chat requests found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search requests..."
        onRowClick={(row) => setSelectedRequest(row)}
        actions={(row) => (
          <button
            onClick={() => setSelectedRequest(row)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View
          </button>
        )}
      />

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedRequest(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-dark-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark-900">Chat Request Details</h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-dark-400 hover:text-dark-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-dark-400 uppercase font-medium">Name</p>
                  <p className="text-sm text-dark-900 mt-0.5">{selectedRequest.name}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 uppercase font-medium">Email</p>
                  <p className="text-sm text-dark-900 mt-0.5">{selectedRequest.email}</p>
                </div>
                {selectedRequest.phone && (
                  <div>
                    <p className="text-xs text-dark-400 uppercase font-medium">Phone</p>
                    <p className="text-sm text-dark-900 mt-0.5">{selectedRequest.phone}</p>
                  </div>
                )}
                {selectedRequest.company && (
                  <div>
                    <p className="text-xs text-dark-400 uppercase font-medium">Company</p>
                    <p className="text-sm text-dark-900 mt-0.5">{selectedRequest.company}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-dark-400 uppercase font-medium">Request Type</p>
                  <p className="text-sm text-dark-900 mt-0.5 capitalize">{selectedRequest.requestType}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400 uppercase font-medium">Priority</p>
                  <StatusBadge
                    label={selectedRequest.priority || 'Normal'}
                    variant={priorityVariant(selectedRequest.priority)}
                  />
                </div>
                {selectedRequest.serviceInterest && (
                  <div>
                    <p className="text-xs text-dark-400 uppercase font-medium">Service Interest</p>
                    <p className="text-sm text-dark-900 mt-0.5">{selectedRequest.serviceInterest}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-dark-400 uppercase font-medium">Status</p>
                  <StatusBadge
                    label={selectedRequest.isResolved ? 'Resolved' : 'Pending'}
                    variant={selectedRequest.isResolved ? 'success' : 'warning'}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-dark-400 uppercase font-medium mb-1">Message</p>
                <p className="text-sm text-dark-700 whitespace-pre-wrap bg-dark-50 rounded-lg p-3">
                  {selectedRequest.message}
                </p>
              </div>

              {selectedRequest.adminNotes && (
                <div>
                  <p className="text-xs text-dark-400 uppercase font-medium mb-1">Admin Notes</p>
                  <p className="text-sm text-dark-700 bg-green-50 rounded-lg p-3">
                    {selectedRequest.adminNotes}
                  </p>
                </div>
              )}

              {/* Assign Section */}
              <div className="border-t border-dark-200 pt-4">
                <p className="text-xs text-dark-400 uppercase font-medium mb-2">
                  Assign To {selectedRequest.assignedTo && `(Currently: ${selectedRequest.assignedTo})`}
                </p>
                <div className="flex gap-2">
                  <select
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                    className="flex-1 px-3 py-2 border border-dark-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="">Select team member</option>
                    <option value="Admin">Admin</option>
                    <option value="Sales">Sales</option>
                    <option value="Support">Support</option>
                    <option value="HR">HR</option>
                  </select>
                  <button
                    onClick={() => handleAssign(selectedRequest)}
                    disabled={actionLoading || !assignTo}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    Assign
                  </button>
                </div>
              </div>

              {/* Resolve Section */}
              {!selectedRequest.isResolved && (
                <div className="border-t border-dark-200 pt-4">
                  <p className="text-xs text-dark-400 uppercase font-medium mb-2">Resolve Request</p>
                  <textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder="Add resolution notes..."
                    rows={3}
                    className="w-full px-3 py-2 border border-dark-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-vertical"
                  />
                  <button
                    onClick={() => handleResolve(selectedRequest)}
                    disabled={actionLoading}
                    className="mt-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? 'Processing...' : 'Mark as Resolved'}
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-dark-200 text-right">
              <span className="text-xs text-dark-400">Submitted: {formatDate(selectedRequest.createdAt)}</span>
              {selectedRequest.resolvedAt && (
                <span className="text-xs text-dark-400 ml-4">Resolved: {formatDate(selectedRequest.resolvedAt)}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
