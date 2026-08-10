'use client';

import { useState, useEffect, useCallback } from 'react';
import { contactApi, type ContactMessage } from '@/lib/api';
import StatusBadge from '@/components/admin/StatusBadge';

type FilterType = 'all' | 'unread' | 'archived';

export default function MessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [allMessages, unreadData] = await Promise.all([
        contactApi.getAll(),
        contactApi.getUnreadCount(),
      ]);
      setMessages(allMessages);
      setUnreadCount(unreadData.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkAsRead = async (msg: ContactMessage) => {
    try {
      await contactApi.markAsRead(msg.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage({ ...msg, isRead: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
    }
  };

  const handleArchive = async (msg: ContactMessage) => {
    try {
      await contactApi.archive(msg.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isArchived: true } : m))
      );
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive message');
    }
  };

  const handleSelectMessage = async (msg: ContactMessage) => {
    setSelectedMessage(msg);
    if (!msg.isRead) {
      await handleMarkAsRead(msg);
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (filter === 'unread' && msg.isRead) return false;
    if (filter === 'archived' && !msg.isArchived) return false;
    if (filter === 'all' && msg.isArchived) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        msg.name.toLowerCase().includes(q) ||
        msg.email.toLowerCase().includes(q) ||
        msg.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-dark-500">Loading messages...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">
            Messages
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="text-dark-500 mt-1">Contact form submissions from your website.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-800 font-medium">Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1 bg-dark-100 rounded-lg p-1">
          {(['all', 'unread', 'archived'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                filter === f
                  ? 'bg-white text-dark-900 shadow-sm'
                  : 'text-dark-500 hover:text-dark-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-dark-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm max-h-[calc(100vh-280px)] overflow-y-auto">
          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center text-dark-400">No messages found.</div>
          ) : (
            <div className="divide-y divide-dark-100">
              {filteredMessages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg)}
                  className={`w-full text-left px-4 py-3 hover:bg-dark-50 transition-colors ${
                    selectedMessage?.id === msg.id ? 'bg-primary-50 border-l-2 border-primary-600' : ''
                  } ${!msg.isRead ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <p className={`text-sm ${!msg.isRead ? 'font-semibold text-dark-900' : 'font-medium text-dark-700'}`}>
                      {msg.name}
                    </p>
                    {!msg.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5"></span>
                    )}
                  </div>
                  <p className="text-sm text-dark-600 truncate mt-0.5">{msg.subject}</p>
                  <p className="text-xs text-dark-400 mt-1">{formatDate(msg.createdAt)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm">
          {selectedMessage ? (
            <div>
              <div className="px-6 py-4 border-b border-dark-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-dark-900">{selectedMessage.subject}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-sm text-dark-600">{selectedMessage.name}</p>
                      <span className="text-dark-300">|</span>
                      <a href={`mailto:${selectedMessage.email}`} className="text-sm text-primary-600 hover:text-primary-700">
                        {selectedMessage.email}
                      </a>
                      {selectedMessage.phone && (
                        <>
                          <span className="text-dark-300">|</span>
                          <span className="text-sm text-dark-500">{selectedMessage.phone}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge
                        label={selectedMessage.isRead ? 'Read' : 'Unread'}
                        variant={selectedMessage.isRead ? 'neutral' : 'info'}
                      />
                      {selectedMessage.isArchived && <StatusBadge label="Archived" variant="warning" />}
                      {selectedMessage.company && (
                        <span className="text-xs text-dark-400">Company: {selectedMessage.company}</span>
                      )}
                      {selectedMessage.serviceInterest && (
                        <span className="text-xs text-dark-400">Interest: {selectedMessage.serviceInterest}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-dark-400">{formatDate(selectedMessage.createdAt)}</span>
                </div>
              </div>
              <div className="px-6 py-6">
                <p className="text-dark-700 whitespace-pre-wrap leading-relaxed">
                  {selectedMessage.message}
                </p>
              </div>
              <div className="px-6 py-4 border-t border-dark-200 flex items-center gap-3">
                {!selectedMessage.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(selectedMessage)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Mark as Read
                  </button>
                )}
                {!selectedMessage.isArchived && (
                  <button
                    onClick={() => handleArchive(selectedMessage)}
                    className="text-sm text-dark-500 hover:text-dark-700 font-medium"
                  >
                    Archive
                  </button>
                )}
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject)}`}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium ml-auto"
                >
                  Reply via Email
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-dark-400">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p>Select a message to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
