'use client';

import { useState, useEffect, useCallback } from 'react';

interface Receipt {
  id: number;
  receipt_number: string | null;
  vendor_name: string | null;
  vendor_address: string | null;
  receipt_date: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  subtotal: number | null;
  currency: string;
  category: string;
  status: string;
  file_name: string | null;
  file_url: string | null;
  ocr_raw_text: string | null;
  extracted_data: Record<string, unknown>;
  notes: string | null;
  uploaded_by: string | null;
  department: string | null;
  project: string | null;
  created_at: string;
}

const TABS = ['All Receipts', 'Upload Receipt', 'AI Processing', 'Analytics', 'Export'] as const;
type Tab = typeof TABS[number];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  processing: 'bg-blue-500/20 text-blue-300',
  verified: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300',
  archived: 'bg-gray-500/20 text-gray-300',
};

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-white/10 text-white/70',
  advertising: 'bg-purple-500/20 text-purple-300',
  software: 'bg-cyan-500/20 text-cyan-300',
  travel: 'bg-orange-500/20 text-orange-300',
  meals: 'bg-green-500/20 text-green-300',
  equipment: 'bg-blue-500/20 text-blue-300',
  subscription: 'bg-pink-500/20 text-pink-300',
};

const fmt = (n: number | null | undefined) =>
  n != null ? `$${Number(n).toFixed(2)}` : '—';

export default function ReceiptDigitizationPage() {
  const [tab, setTab] = useState<Tab>('All Receipts');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);
  const [processingResult, setProcessingResult] = useState<Record<number, Record<string, unknown>>>({});
  const [form, setForm] = useState({
    receipt_number: '', vendor_name: '', vendor_address: '', receipt_date: '',
    total_amount: '', tax_amount: '', currency: 'USD', category: 'general',
    department: '', project: '', file_name: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/admin/receipts${qs}`);
      const data = await res.json() as { receipts?: Receipt[] };
      setReceipts(data.receipts ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    await fetch('/api/admin/receipts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    void load();
  };

  const processWithAI = async (id: number) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/receipts/${id}/process`, { method: 'POST' });
      const data = await res.json() as { extracted_data?: Record<string, unknown> };
      if (data.extracted_data) {
        setProcessingResult(prev => ({ ...prev, [id]: data.extracted_data as Record<string, unknown> }));
      }
      void load();
    } finally {
      setProcessing(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          total_amount: form.total_amount ? Number(form.total_amount) : null,
          tax_amount: form.tax_amount ? Number(form.tax_amount) : 0,
        }),
      });
      if (res.ok) {
        setMsg('Receipt uploaded successfully.');
        setForm({ receipt_number: '', vendor_name: '', vendor_address: '', receipt_date: '',
          total_amount: '', tax_amount: '', currency: 'USD', category: 'general',
          department: '', project: '', file_name: '', notes: '' });
        void load();
      } else {
        const d = await res.json() as { error?: string };
        setMsg(d.error ?? 'Error uploading receipt.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Analytics
  const totalSpend = receipts.reduce((a, r) => a + (Number(r.total_amount) || 0), 0);
  const byCategory = receipts.reduce<Record<string, number>>((acc, r) => {
    const c = r.category || 'general';
    acc[c] = (acc[c] || 0) + (Number(r.total_amount) || 0);
    return acc;
  }, {});
  const byDept = receipts.reduce<Record<string, number>>((acc, r) => {
    const d = r.department || 'Unknown';
    acc[d] = (acc[d] || 0) + (Number(r.total_amount) || 0);
    return acc;
  }, {});
  const topVendors = Object.entries(
    receipts.reduce<Record<string, number>>((acc, r) => {
      const v = r.vendor_name || 'Unknown';
      acc[v] = (acc[v] || 0) + (Number(r.total_amount) || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCatSpend = Math.max(...Object.values(byCategory), 1);

  const exportCSV = () => {
    const headers = ['receipt_number', 'vendor_name', 'receipt_date', 'total_amount', 'category', 'department', 'status'];
    const rows = receipts.map(r => [
      r.receipt_number ?? '', r.vendor_name ?? '',
      r.receipt_date ? r.receipt_date.substring(0, 10) : '',
      r.total_amount ?? '', r.category, r.department ?? '', r.status,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `receipts-${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
  };

  const glass = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Receipt Digitization</h1>
        <p className="text-white/60 mb-6">Upload, OCR-process and AI-extract structured data from receipts.</p>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* All Receipts */}
        {tab === 'All Receipts' && (
          <div className={glass}>
            <div className="flex flex-wrap gap-2 mb-4">
              {['', 'pending', 'processing', 'verified', 'rejected', 'archived'].map(s => (
                <button
                  key={s || 'all'}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border border-white/20 ${
                    statusFilter === s ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
                  }`}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>
            {loading ? (
              <p className="text-white/50 text-sm">Loading...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-white/80">
                  <thead>
                    <tr className="text-white/40 text-xs border-b border-white/10">
                      {['Receipt #', 'Vendor', 'Date', 'Amount', 'Category', 'Dept', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left py-2 px-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map(r => (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-3 font-mono text-xs">{r.receipt_number ?? '—'}</td>
                        <td className="py-2 px-3">{r.vendor_name ?? '—'}</td>
                        <td className="py-2 px-3 text-xs">{r.receipt_date ? r.receipt_date.substring(0, 10) : '—'}</td>
                        <td className="py-2 px-3 font-medium">{fmt(r.total_amount)}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${CATEGORY_COLORS[r.category] ?? 'bg-white/10 text-white/70'}`}>
                            {r.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs">{r.department ?? '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[r.status] ?? 'bg-white/10 text-white/70'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex gap-1">
                            <button onClick={() => processWithAI(r.id)} disabled={processing === r.id}
                              className="text-xs bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 px-2 py-0.5 rounded transition-all">
                              {processing === r.id ? '...' : 'AI'}
                            </button>
                            <button onClick={() => updateStatus(r.id, 'verified')}
                              className="text-xs bg-green-500/20 hover:bg-green-500/40 text-green-300 px-2 py-0.5 rounded transition-all">
                              Verify
                            </button>
                            <button onClick={() => updateStatus(r.id, 'rejected')}
                              className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-300 px-2 py-0.5 rounded transition-all">
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!receipts.length && (
                      <tr><td colSpan={8} className="py-8 text-center text-white/30">No receipts found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Upload Receipt */}
        {tab === 'Upload Receipt' && (
          <div className={glass}>
            <h2 className="text-lg font-semibold text-white mb-4">Upload New Receipt</h2>
            <p className="text-white/50 text-xs mb-4">Note: Enter the file name only. Actual file upload requires server-side storage configuration.</p>
            {msg && <div className={`mb-4 p-3 rounded-lg text-sm ${msg.includes('success') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{msg}</div>}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Receipt Number', key: 'receipt_number', type: 'text' },
                { label: 'Vendor Name', key: 'vendor_name', type: 'text' },
                { label: 'Receipt Date', key: 'receipt_date', type: 'date' },
                { label: 'Total Amount', key: 'total_amount', type: 'number' },
                { label: 'Tax Amount', key: 'tax_amount', type: 'number' },
                { label: 'Department', key: 'department', type: 'text' },
                { label: 'Project', key: 'project', type: 'text' },
                { label: 'File Name (e.g. receipt.jpg)', key: 'file_name', type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-white/60 text-xs block mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-400"
                    step={type === 'number' ? '0.01' : undefined}
                  />
                </div>
              ))}

              <div>
                <label className="text-white/60 text-xs block mb-1">Vendor Address</label>
                <input type="text" value={form.vendor_address}
                  onChange={e => setForm(f => ({ ...f, vendor_address: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Currency</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                  {['USD', 'CAD', 'EUR', 'GBP', 'INR'].map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                  {['general', 'advertising', 'software', 'travel', 'meals', 'equipment', 'subscription'].map(c => (
                    <option key={c} value={c} className="bg-slate-800">{c}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-white/60 text-xs block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-purple-400" />
              </div>

              <div className="md:col-span-2">
                <button type="submit" disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                  {saving ? 'Uploading...' : 'Upload Receipt'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* AI Processing */}
        {tab === 'AI Processing' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {receipts.filter(r => r.status === 'pending').map(r => (
              <div key={r.id} className={glass}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-white font-medium">{r.vendor_name ?? 'Unknown Vendor'}</p>
                    <p className="text-white/50 text-xs">{r.receipt_date ? r.receipt_date.substring(0, 10) : '—'} · {fmt(r.total_amount)}</p>
                  </div>
                  <button onClick={() => processWithAI(r.id)} disabled={processing === r.id}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                    {processing === r.id ? 'Processing...' : 'Process with AI'}
                  </button>
                </div>
                {r.ocr_raw_text && (
                  <div className="mb-3">
                    <p className="text-white/40 text-xs mb-1">OCR Raw Text:</p>
                    <pre className="text-white/70 text-xs bg-black/20 rounded p-2 overflow-auto max-h-24 whitespace-pre-wrap">{r.ocr_raw_text}</pre>
                  </div>
                )}
                {processingResult[r.id] && (
                  <div>
                    <p className="text-green-400 text-xs mb-1">AI Extracted Data:</p>
                    <pre className="text-white/70 text-xs bg-black/20 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
                      {JSON.stringify(processingResult[r.id], null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
            {!receipts.filter(r => r.status === 'pending').length && (
              <div className={`${glass} md:col-span-2`}>
                <p className="text-white/30 text-center py-8">No pending receipts to process.</p>
              </div>
            )}
          </div>
        )}

        {/* Analytics */}
        {tab === 'Analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Total Receipts', value: receipts.length },
                  { label: 'Total Spend', value: fmt(totalSpend) },
                  { label: 'Pending', value: receipts.filter(r => r.status === 'pending').length },
                  { label: 'Verified', value: receipts.filter(r => r.status === 'verified').length },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/50 text-xs">{label}</p>
                    <p className="text-white text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Spend by Category</h3>
              <div className="space-y-2">
                {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-white/60">{cat}</span>
                      <span className="text-white">{fmt(amt)}</span>
                    </div>
                    <div className="bg-white/10 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(amt / maxCatSpend) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Top Vendors by Spend</h3>
              <div className="space-y-2">
                {topVendors.map(([vendor, amt], i) => (
                  <div key={vendor} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-white/30 text-xs">#{i + 1}</span>
                      <span className="text-white/80 text-sm">{vendor}</span>
                    </div>
                    <span className="text-white font-medium text-sm">{fmt(amt)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Spend by Department</h3>
              <div className="space-y-2">
                {Object.entries(byDept).sort((a, b) => b[1] - a[1]).map(([dept, amt]) => (
                  <div key={dept} className="flex justify-between items-center text-sm">
                    <span className="text-white/70">{dept}</span>
                    <span className="text-white font-medium">{fmt(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Export */}
        {tab === 'Export' && (
          <div className={glass}>
            <h2 className="text-lg font-semibold text-white mb-4">Export Receipts</h2>
            <p className="text-white/60 text-sm mb-6">
              Download all {receipts.length} receipts as a CSV file with fields: receipt_number, vendor_name, receipt_date, total_amount, category, department, status.
            </p>
            <button onClick={exportCSV}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all">
              Download CSV ({receipts.length} records)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
