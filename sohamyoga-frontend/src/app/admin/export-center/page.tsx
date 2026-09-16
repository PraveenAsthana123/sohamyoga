'use client';

import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ExportType = 'csv' | 'xls' | 'pdf';
type Dataset = 'invoices' | 'contracts' | 'leads' | 'orders' | 'analytics' | 'brochures';

interface ExportHistoryEntry {
  id: string;
  dataset: Dataset;
  type: ExportType;
  status: 'success' | 'error';
  rowCount?: number;
  timestamp: string;
  filename?: string;
}

interface PrintData {
  title: string;
  dataset: string;
  columns: string[];
  rows: Record<string, unknown>[];
  generatedAt: string;
  filters: { startDate?: string; endDate?: string; status?: string };
  rowCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DATASETS: { key: Dataset; label: string; icon: string; description: string }[] = [
  { key: 'invoices', label: 'Invoices', icon: '🧾', description: 'Customer invoices, amounts, due dates' },
  { key: 'contracts', label: 'Contracts', icon: '📄', description: 'Client contracts, status, signed dates' },
  { key: 'leads', label: 'Leads', icon: '🎯', description: 'CRM leads, scores, pipeline stages' },
  { key: 'orders', label: 'Orders', icon: '📦', description: 'E-commerce orders and revenue' },
  { key: 'brochures', label: 'Brochures', icon: '📑', description: 'Brochure inventory and download stats' },
];

const EXPORT_TYPES: { key: ExportType; label: string; description: string }[] = [
  { key: 'csv', label: 'CSV / XLS', description: 'Comma-separated — opens in Excel, Google Sheets' },
  { key: 'pdf', label: 'Print (PDF)', description: 'Formatted printable report via browser' },
];

const STATUSES_BY_DATASET: Partial<Record<Dataset, string[]>> = {
  invoices: ['draft', 'submitted', 'paid', 'overdue', 'cancelled'],
  contracts: ['draft', 'sent', 'signed', 'expired', 'cancelled'],
  leads: ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'],
  orders: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
  brochures: ['draft', 'published', 'archived'],
};

const HISTORY_KEY = 'sohamyoga_export_history';

function loadHistory(): ExportHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as ExportHistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: ExportHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 10)));
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString();
  const s = String(v);
  if (s.match(/^\d{4}-\d{2}-\d{2}T/)) return new Date(s).toLocaleString();
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 10);
  return s;
}

// ── Print Helper ──────────────────────────────────────────────────────────────

function openPrintWindow(data: PrintData) {
  const filters = [
    data.filters.startDate ? `From: ${data.filters.startDate}` : '',
    data.filters.endDate ? `To: ${data.filters.endDate}` : '',
    data.filters.status ? `Status: ${data.filters.status}` : '',
  ].filter(Boolean).join(' | ');

  const header = data.columns.map(c => `<th>${c.replace(/_/g, ' ').toUpperCase()}</th>`).join('');
  const bodyRows = data.rows.map(row => `
    <tr>${data.columns.map(col => `<td>${fmt(row[col])}</td>`).join('')}</tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${data.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .meta { color: #6b7280; font-size: 11px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e3a5f; color: white; text-align: left; padding: 6px 8px; font-size: 10px; white-space: nowrap; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    .footer { margin-top: 16px; color: #9ca3af; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>${data.title}</h1>
  <div class="meta">
    Generated: ${new Date(data.generatedAt).toLocaleString()} &nbsp;|&nbsp;
    Rows: ${data.rowCount}
    ${filters ? ` &nbsp;|&nbsp; ${filters}` : ''}
  </div>
  <table>
    <thead><tr>${header}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="footer">Soham Yoga — Admin Export Center</div>
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExportCenterPage() {
  const [selectedDataset, setSelectedDataset] = useState<Dataset>('invoices');
  const [exportType, setExportType] = useState<ExportType>('csv');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<ExportHistoryEntry[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    const timestamp = new Date().toISOString();

    try {
      const res = await fetch('/api/admin/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: exportType,
          dataset: selectedDataset,
          filters: {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            status: status || undefined,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Export failed');
      }

      if (exportType === 'pdf') {
        const data = await res.json() as PrintData;
        openPrintWindow(data);
        const entry: ExportHistoryEntry = {
          id: Math.random().toString(36).slice(2),
          dataset: selectedDataset,
          type: exportType,
          status: 'success',
          rowCount: data.rowCount,
          timestamp,
        };
        const updated = [entry, ...history].slice(0, 10);
        setHistory(updated);
        saveHistory(updated);
        setMessage({ type: 'success', text: `Print window opened with ${data.rowCount} rows.` });
      } else {
        // CSV / XLS: download
        const blob = await res.blob();
        const contentDisp = res.headers.get('Content-Disposition') ?? '';
        const filenameMatch = contentDisp.match(/filename="([^"]+)"/);
        const filename = filenameMatch?.[1] ?? `export-${selectedDataset}-${Date.now()}.csv`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Estimate row count from blob size
        const text = await blob.text().catch(() => '');
        const rowCount = Math.max(0, text.split('\n').length - 2); // minus header and trailing newline

        const entry: ExportHistoryEntry = {
          id: Math.random().toString(36).slice(2),
          dataset: selectedDataset,
          type: exportType,
          status: 'success',
          rowCount,
          timestamp,
          filename,
        };
        const updated = [entry, ...history].slice(0, 10);
        setHistory(updated);
        saveHistory(updated);
        setMessage({ type: 'success', text: `Downloaded ${filename} (${rowCount} rows).` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      const entry: ExportHistoryEntry = {
        id: Math.random().toString(36).slice(2),
        dataset: selectedDataset,
        type: exportType,
        status: 'error',
        timestamp,
      };
      const updated = [entry, ...history].slice(0, 10);
      setHistory(updated);
      saveHistory(updated);
      setMessage({ type: 'error', text: msg });
    } finally {
      setExporting(false);
    }
  };

  const statusOptions = STATUSES_BY_DATASET[selectedDataset] ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Export Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Export data from any module as CSV, XLS, or printable PDF report</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Message */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.type === 'success' ? '✓ ' : '✗ '}{message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Controls */}
          <div className="lg:col-span-2 space-y-5">
            {/* Dataset Selection */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">1. Choose Dataset</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DATASETS.map(d => (
                  <button
                    key={d.key}
                    onClick={() => { setSelectedDataset(d.key); setStatus(''); }}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                      selectedDataset === d.key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{d.icon}</span>
                    <div>
                      <p className={`text-sm font-medium ${selectedDataset === d.key ? 'text-blue-700' : 'text-gray-800'}`}>{d.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{d.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">2. Export Format</h2>
              <div className="grid grid-cols-2 gap-3">
                {EXPORT_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setExportType(t.key)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      exportType === t.key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${exportType === t.key ? 'text-blue-700' : 'text-gray-800'}`}>{t.label}</p>
                    <p className="text-xs text-gray-400 mt-1">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">3. Filters (optional)</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
                {statusOptions.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status Filter</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      {statusOptions.map(s => (
                        <option key={s} value={s} className="capitalize">{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Summary + Action */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Export Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Dataset</span>
                  <span className="font-medium text-gray-800 capitalize">{selectedDataset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Format</span>
                  <span className="font-medium text-gray-800">{exportType.toUpperCase()}</span>
                </div>
                {startDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">From</span>
                    <span className="font-medium text-gray-800">{startDate}</span>
                  </div>
                )}
                {endDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">To</span>
                    <span className="font-medium text-gray-800">{endDate}</span>
                  </div>
                )}
                {status && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="font-medium text-gray-800 capitalize">{status}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleExport}
                disabled={exporting}
                className="mt-5 w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {exporting ? 'Exporting…' : exportType === 'pdf' ? 'Generate Print Report' : 'Download CSV'}
              </button>
            </div>

            {/* History */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Recent Exports</h2>
                {history.length > 0 && (
                  <button
                    onClick={() => { setHistory([]); saveHistory([]); }}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Clear
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-gray-400">No exports yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map(entry => (
                    <div key={entry.id} className="flex items-start gap-2 text-xs">
                      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${entry.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-700 capitalize">{entry.dataset} · {entry.type.toUpperCase()}</p>
                        {entry.rowCount !== undefined && (
                          <p className="text-gray-400">{entry.rowCount} rows</p>
                        )}
                        {entry.filename && (
                          <p className="text-gray-400 truncate">{entry.filename}</p>
                        )}
                        <p className="text-gray-400">{new Date(entry.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
