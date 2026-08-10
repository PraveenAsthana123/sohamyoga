'use client';

import { useState, useEffect, useCallback } from 'react';
import { newsletterApi, type NewsletterSubscriber } from '@/lib/api';
import AdminTable, { type Column } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [subs, countData] = await Promise.all([
        newsletterApi.getSubscribers(),
        newsletterApi.getCount(),
      ]);
      setSubscribers(subs);
      setSubscriberCount(countData.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCSV = () => {
    const activeSubscribers = subscribers.filter((s) => s.isActive);
    const csvRows = [
      ['Email', 'Name', 'Subscribed Date'].join(','),
      ...activeSubscribers.map((s) =>
        [
          `"${s.email}"`,
          `"${s.name || ''}"`,
          `"${new Date(s.subscribedAt).toLocaleDateString()}"`,
        ].join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredSubscribers = search
    ? subscribers.filter(
        (s) =>
          s.email.toLowerCase().includes(search.toLowerCase()) ||
          (s.name && s.name.toLowerCase().includes(search.toLowerCase()))
      )
    : subscribers;

  const columns: Column<NewsletterSubscriber>[] = [
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (sub) => <span className="font-medium text-dark-900">{sub.email}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (sub) => <span className="text-dark-600">{sub.name || '-'}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (sub) => (
        <StatusBadge
          label={sub.isActive ? 'Active' : 'Unsubscribed'}
          variant={sub.isActive ? 'success' : 'neutral'}
        />
      ),
    },
    {
      key: 'subscribedAt',
      label: 'Subscribed Date',
      sortable: true,
      render: (sub) => <span className="text-dark-500">{formatDate(sub.subscribedAt)}</span>,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Newsletter</h1>
          <p className="text-dark-500 mt-1">Manage newsletter subscribers.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-800 font-medium">Dismiss</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-dark-500">Total Subscribers</p>
          <p className="text-3xl font-bold text-dark-900 mt-1">{subscriberCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-dark-500">Active Subscribers</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {subscribers.filter((s) => s.isActive).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-dark-500">Unsubscribed</p>
          <p className="text-3xl font-bold text-dark-400 mt-1">
            {subscribers.filter((s) => !s.isActive).length}
          </p>
        </div>
      </div>

      <AdminTable<NewsletterSubscriber>
        columns={columns}
        data={filteredSubscribers}
        keyField="id"
        loading={loading}
        emptyMessage="No subscribers found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search subscribers..."
        headerActions={
          <button
            onClick={handleExportCSV}
            disabled={subscribers.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-dark-700 bg-dark-100 rounded-lg hover:bg-dark-200 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        }
      />
    </div>
  );
}
