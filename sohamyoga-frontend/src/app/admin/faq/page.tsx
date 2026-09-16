'use client';

import { useState, useEffect, useCallback } from 'react';

type FAQCategory = 'general' | 'class' | 'membership' | 'payment' | 'ai_feature';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: FAQCategory;
  sort_order: number;
  published: boolean;
  views: number;
  helpful_yes: number;
  helpful_no: number;
  created_at: string;
  updated_at: string;
}

interface CategoryCount {
  category: string;
  total: number;
  published_count: number;
}

interface APIResponse {
  faqs: FAQItem[];
  counts: CategoryCount[];
  total: number;
}

const CATEGORY_LABELS: Record<FAQCategory, string> = {
  general: 'General',
  class: 'Class',
  membership: 'Membership',
  payment: 'Payment',
  ai_feature: 'AI Features',
};

const CATEGORY_COLOR: Record<FAQCategory, string> = {
  general: 'bg-gray-100 text-gray-700',
  class: 'bg-green-100 text-green-700',
  membership: 'bg-purple-100 text-purple-700',
  payment: 'bg-yellow-100 text-yellow-700',
  ai_feature: 'bg-blue-100 text-blue-700',
};

const EMPTY_DRAFT = {
  question: '',
  answer: '',
  category: 'general' as FAQCategory,
  sort_order: 0,
  published: false,
};

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FAQForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: typeof EMPTY_DRAFT;
  onSubmit: (data: typeof EMPTY_DRAFT) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState(initial);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase">Category</label>
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as FAQCategory }))}
          className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {(Object.entries(CATEGORY_LABELS) as [FAQCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase">Question</label>
        <input
          value={form.question}
          onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          placeholder="Enter question"
          className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase">Answer</label>
        <textarea
          value={form.answer}
          onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
          placeholder="Enter answer"
          rows={4}
          className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>
      <div className="flex items-center gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase">Sort Order</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
            className="mt-1 w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <input
            type="checkbox"
            id="published"
            checked={form.published}
            onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
            className="w-4 h-4 accent-green-600"
          />
          <label htmlFor="published" className="text-sm font-medium text-gray-700">
            Published
          </label>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onSubmit(form)}
          disabled={submitting || !form.question.trim() || !form.answer.trim()}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          {submitting ? 'Saving…' : 'Save FAQ'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AdminFAQPage() {
  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FAQCategory | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<FAQItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/faq');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as APIResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered =
    data?.faqs.filter((f) => activeTab === 'all' || f.category === activeTab) ?? [];

  function getCategoryCount(cat: FAQCategory | 'all'): number {
    if (cat === 'all') return data?.total ?? 0;
    return data?.counts.find((c) => c.category === cat)?.total ?? 0;
  }

  async function handleCreate(form: typeof EMPTY_DRAFT) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setShowCreate(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(form: typeof EMPTY_DRAFT) {
    if (!editItem) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/faq', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editItem.id, ...form }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setEditItem(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePublished(item: FAQItem) {
    try {
      const res = await fetch('/api/admin/faq', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, published: !item.published }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Toggle failed');
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/admin/faq?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteConfirm(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const TABS: Array<FAQCategory | 'all'> = ['all', 'general', 'class', 'membership', 'payment', 'ai_feature'];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FAQ Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage frequently asked questions across all categories
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          + Add FAQ
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'all' ? 'All' : CATEGORY_LABELS[tab]} ({getCategoryCount(tab)})
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="text-center py-12 text-gray-400">Loading FAQs…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}{' '}
          <button onClick={() => void load()} className="underline ml-2">
            Retry
          </button>
        </div>
      )}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
              No FAQs in this category yet.
            </div>
          )}
          {filtered.map((faq) => (
            <div
              key={faq.id}
              className={`bg-white border rounded-2xl p-5 shadow-sm transition-opacity ${
                !faq.published ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLOR[faq.category]}`}
                    >
                      {CATEGORY_LABELS[faq.category]}
                    </span>
                    {!faq.published && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                        Hidden
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{faq.views} views</span>
                    <span className="text-xs text-gray-400">
                      👍 {faq.helpful_yes} · 👎 {faq.helpful_no}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">Q: {faq.question}</p>
                  <p className="text-gray-600 text-sm">A: {faq.answer}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setEditItem(faq)
                    }
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void handleTogglePublished(faq)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      faq.published
                        ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}
                  >
                    {faq.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(faq.id)}
                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="New FAQ" onClose={() => setShowCreate(false)}>
          <FAQForm
            initial={EMPTY_DRAFT}
            onSubmit={(form) => void handleCreate(form)}
            onCancel={() => setShowCreate(false)}
            submitting={submitting}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {editItem && (
        <Modal title="Edit FAQ" onClose={() => setEditItem(null)}>
          <FAQForm
            initial={{
              question: editItem.question,
              answer: editItem.answer,
              category: editItem.category,
              sort_order: editItem.sort_order,
              published: editItem.published,
            }}
            onSubmit={(form) => void handleEdit(form)}
            onCancel={() => setEditItem(null)}
            submitting={submitting}
          />
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm !== null && (
        <Modal title="Confirm Delete" onClose={() => setDeleteConfirm(null)}>
          <p className="text-sm text-gray-700">
            Are you sure you want to delete this FAQ? This action cannot be undone.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => void handleDelete(deleteConfirm)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
