'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contract {
  id: string;
  title: string;
  client_name: string;
  client_email: string | null;
  contract_type: string;
  status: string;
  value_cad: string | null;
  start_date: string | null;
  end_date: string | null;
  signed_at: string | null;
  pdf_url: string | null;
  notes: string | null;
  content_html: string | null;
  created_at: string;
}

interface ContractForm {
  title: string;
  client_name: string;
  client_email: string;
  contract_type: string;
  value_cad: string;
  start_date: string;
  end_date: string;
  content_html: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUSES = ['draft', 'sent', 'signed', 'expired', 'cancelled'];
const TYPES = ['service', 'retainer', 'project', 'nda'];

function statusBadge(s: string): string {
  const m: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-amber-100 text-amber-700',
    signed: 'bg-green-100 text-green-700',
    expired: 'bg-red-100 text-red-700',
    cancelled: 'bg-red-50 text-red-500',
  };
  return m[s] ?? 'bg-gray-100 text-gray-600';
}

function fmt(v: string | null, decimals = 2) {
  if (!v) return '—';
  return `$${Number(v).toLocaleString('en-CA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return d.slice(0, 10);
}

const EMPTY_FORM: ContractForm = {
  title: '', client_name: '', client_email: '', contract_type: 'service',
  value_cad: '', start_date: '', end_date: '', content_html: '', notes: '',
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const [tab, setTab] = useState<'all' | 'draft' | 'sent' | 'signed' | 'analytics'>('all');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ContractForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingContent, setSavingContent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/contracts');
      const data = await res.json() as { contracts?: Contract[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setContracts(data.contracts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = contracts.filter(c => {
    if (tab === 'all') return true;
    if (tab === 'analytics') return false;
    return c.status === tab;
  });

  const handleCreate = async () => {
    if (!form.title || !form.client_name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          value_cad: form.value_cad ? Number(form.value_cad) : null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      alert('Error creating contract.');
    } finally {
      setCreating(false);
    }
  };

  const handlePatch = async (id: string, patch: Partial<Contract>) => {
    try {
      const res = await fetch(`/api/admin/contracts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to update');
      await load();
      if (selected?.id === id) {
        const data = await res.json() as { contract: Contract };
        setSelected(data.contract);
      }
    } catch {
      alert('Error updating contract.');
    }
  };

  const handleMarkSigned = async (id: string) => {
    await handlePatch(id, { status: 'signed', signed_at: new Date().toISOString() });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contract?')) return;
    await fetch(`/api/admin/contracts/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    await load();
  };

  const handleDownload = async (id: string, title: string) => {
    const res = await fetch(`/api/admin/contracts/${id}/pdf`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-${title.replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveContent = async () => {
    if (!selected) return;
    setSavingContent(true);
    await handlePatch(selected.id, { content_html: editContent });
    setSavingContent(false);
  };

  // Analytics
  const totalValue = contracts.reduce((sum, c) => sum + (c.value_cad ? Number(c.value_cad) : 0), 0);
  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = contracts.filter(c => c.status === s).length;
    return acc;
  }, {} as Record<string, number>);
  const signedValue = contracts.filter(c => c.status === 'signed').reduce((s, c) => s + (c.value_cad ? Number(c.value_cad) : 0), 0);

  const TABS = [
    { key: 'all', label: 'All Contracts' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'signed', label: 'Signed' },
    { key: 'analytics', label: 'Analytics' },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contract Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">{contracts.length} contracts · Total value {fmt(String(totalValue))}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + New Contract
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.key !== 'analytics' && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5">
                  {t.key === 'all' ? contracts.length : byStatus[t.key] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Error */}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

        {/* Analytics Tab */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STATUSES.map(s => (
                <div key={s} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <p className="text-sm text-gray-500 capitalize">{s}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{byStatus[s] ?? 0}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 col-span-1">
                <p className="text-sm text-gray-500">Total Contract Value</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{fmt(String(totalValue))}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 col-span-1">
                <p className="text-sm text-gray-500">Signed Contract Value</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{fmt(String(signedValue))}</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 col-span-1">
                <p className="text-sm text-gray-500">Conversion Rate</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {contracts.length ? `${Math.round((byStatus.signed ?? 0) / contracts.length * 100)}%` : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contracts Table */}
        {tab !== 'analytics' && (
          <div className="flex gap-6">
            {/* Table */}
            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${selected ? 'flex-1' : 'w-full'}`}>
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No contracts found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Value</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Dates</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(c => (
                      <tr
                        key={c.id}
                        className={`hover:bg-gray-50 cursor-pointer ${selected?.id === c.id ? 'bg-blue-50' : ''}`}
                        onClick={() => { setSelected(c); setEditContent(c.content_html ?? ''); }}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{c.title}</td>
                        <td className="px-4 py-3 text-gray-600">{c.client_name}</td>
                        <td className="px-4 py-3 capitalize text-gray-600">{c.contract_type}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(c.status)}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(c.value_cad)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            {c.status !== 'signed' && (
                              <button
                                onClick={() => handleMarkSigned(c.id)}
                                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                              >
                                Sign
                              </button>
                            )}
                            {c.status === 'draft' && (
                              <a
                                href={`mailto:${c.client_email ?? ''}?subject=${encodeURIComponent(`Contract: ${c.title}`)}&body=${encodeURIComponent('Please review the attached contract.')}`}
                                className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                              >
                                Send
                              </a>
                            )}
                            <button
                              onClick={() => handleDownload(c.id, c.title)}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              PDF
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                            >
                              Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Detail / Editor Panel */}
            {selected && (
              <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selected.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{selected.client_name} · {selected.client_email}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-gray-400">Type</p>
                    <p className="font-medium capitalize">{selected.contract_type}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-gray-400">Value</p>
                    <p className="font-medium">{fmt(selected.value_cad)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-gray-400">Start</p>
                    <p className="font-medium">{fmtDate(selected.start_date)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-gray-400">End</p>
                    <p className="font-medium">{fmtDate(selected.end_date)}</p>
                  </div>
                </div>

                {selected.signed_at && (
                  <p className="text-xs text-green-600">Signed: {new Date(selected.signed_at).toLocaleString()}</p>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    value={selected.status}
                    onChange={async e => {
                      const patch: Partial<Contract> = { status: e.target.value };
                      if (e.target.value === 'signed' && !selected.signed_at) {
                        patch.signed_at = new Date().toISOString();
                      }
                      await handlePatch(selected.id, patch);
                    }}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contract Body (HTML)</label>
                  <textarea
                    className="w-full text-xs border border-gray-300 rounded p-2 h-40 font-mono resize-y"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                  />
                  <button
                    onClick={handleSaveContent}
                    disabled={savingContent}
                    className="mt-1 w-full py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingContent ? 'Saving…' : 'Save Content'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    className="w-full text-xs border border-gray-300 rounded p-2 h-16 resize-y"
                    defaultValue={selected.notes ?? ''}
                    onBlur={e => handlePatch(selected.id, { notes: e.target.value })}
                  />
                </div>

                <div className="flex gap-2">
                  {selected.status !== 'signed' && (
                    <button
                      onClick={() => handleMarkSigned(selected.id)}
                      className="flex-1 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Mark as Signed
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(selected.id, selected.title)}
                    className="flex-1 py-2 text-xs bg-gray-700 text-white rounded hover:bg-gray-800"
                  >
                    Download PDF
                  </button>
                </div>

                {selected.client_email && (
                  <a
                    href={`mailto:${selected.client_email}?subject=${encodeURIComponent(`Contract: ${selected.title}`)}&body=${encodeURIComponent('Please review the attached contract and let us know if you have any questions.')}`}
                    className="block w-full text-center py-2 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
                  >
                    Send to Client (mailto)
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Contract Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New Contract</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Service Agreement 2026"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Acme Corp"
                    value={form.client_name}
                    onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="billing@acme.ca"
                    value={form.client_email}
                    onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.contract_type}
                    onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}
                  >
                    {TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value (CAD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="5000.00"
                    value={form.value_cad}
                    onChange={e => setForm(f => ({ ...f, value_cad: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Body (HTML)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-28 font-mono resize-y"
                  placeholder="<h2>Agreement</h2><p>This agreement…</p>"
                  value={form.content_html}
                  onChange={e => setForm(f => ({ ...f, content_html: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-16 resize-y"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.title || !form.client_name}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
