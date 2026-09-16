'use client';

import { useState, useEffect, useCallback } from 'react';

interface Barcode {
  id: number;
  code: string;
  barcode_type: string;
  entity_type: string;
  entity_id: number | null;
  entity_ref: string | null;
  label: string | null;
  description: string | null;
  is_active: boolean;
  scan_count: number;
  last_scanned_at: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ScanLog {
  id: number;
  barcode_id: number;
  barcode_code: string;
  barcode_label: string | null;
  scanned_at: string;
  scan_source: string;
  location: string | null;
  ip_address: string | null;
}

const TABS = ['All Barcodes', 'Generate Barcode', 'Scan Logs', 'Analytics', 'Bulk Import'] as const;
type Tab = typeof TABS[number];

const TYPE_COLORS: Record<string, string> = {
  QR: 'bg-purple-500/20 text-purple-300',
  EAN13: 'bg-blue-500/20 text-blue-300',
  EAN8: 'bg-cyan-500/20 text-cyan-300',
  UPC_A: 'bg-green-500/20 text-green-300',
  CODE128: 'bg-orange-500/20 text-orange-300',
  CODE39: 'bg-yellow-500/20 text-yellow-300',
  DATAMATRIX: 'bg-pink-500/20 text-pink-300',
};

const ENTITY_COLORS: Record<string, string> = {
  product: 'bg-blue-500/20 text-blue-300',
  coupon: 'bg-green-500/20 text-green-300',
  ticket: 'bg-orange-500/20 text-orange-300',
  asset: 'bg-purple-500/20 text-purple-300',
  location: 'bg-cyan-500/20 text-cyan-300',
  loyalty_card: 'bg-pink-500/20 text-pink-300',
};

const SOURCE_COLORS: Record<string, string> = {
  app: 'bg-blue-500/20 text-blue-300',
  kiosk: 'bg-green-500/20 text-green-300',
  pos: 'bg-orange-500/20 text-orange-300',
  mobile: 'bg-purple-500/20 text-purple-300',
};

export default function BarcodesPage() {
  const [tab, setTab] = useState<Tab>('All Barcodes');
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Barcode | null>(null);

  // Generate form
  const [form, setForm] = useState({
    barcode_type: 'QR', entity_type: 'product', entity_id: '', entity_ref: '',
    label: '', description: '', url: '',
  });
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<Barcode | null>(null);
  const [genMsg, setGenMsg] = useState('');

  // Scan log filter
  const [scanFilter, setScanFilter] = useState('');

  // Bulk import
  const [csvInput, setCsvInput] = useState('');
  const [csvPreview, setCsvPreview] = useState<{ code: string; barcode_type: string; entity_type: string; label: string }[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/barcodes');
      const data = await res.json() as { barcodes?: Barcode[]; scan_logs?: ScanLog[] };
      setBarcodes(data.barcodes ?? []);
      setScanLogs(data.scan_logs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleActive = async (id: number, is_active: boolean) => {
    await fetch('/api/admin/barcodes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    void load();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setGenMsg('');
    setGenerated(null);
    try {
      const res = await fetch('/api/admin/barcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          entity_id: form.entity_id ? Number(form.entity_id) : null,
          url: form.url || null,
        }),
      });
      const data = await res.json() as { barcode?: Barcode; error?: string };
      if (res.ok && data.barcode) {
        setGenerated(data.barcode);
        setForm({ barcode_type: 'QR', entity_type: 'product', entity_id: '', entity_ref: '', label: '', description: '', url: '' });
        void load();
      } else {
        setGenMsg(data.error ?? 'Error generating barcode.');
      }
    } finally {
      setSaving(false);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const parsed = lines.map(line => {
      const [code = '', barcode_type = 'QR', entity_type = 'product', label = ''] = line.split(',').map(s => s.trim());
      return { code, barcode_type, entity_type, label };
    }).filter(r => r.code);
    setCsvPreview(parsed);
  };

  const handleBulkImport = async () => {
    if (!csvPreview.length) return;
    setBulkImporting(true);
    setBulkResult('');
    let success = 0, fail = 0;
    for (const row of csvPreview) {
      const res = await fetch('/api/admin/barcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });
      if (res.ok) success++; else fail++;
    }
    setBulkResult(`Imported: ${success} success, ${fail} failed.`);
    setBulkImporting(false);
    setCsvPreview([]);
    setCsvInput('');
    void load();
  };

  // Analytics
  const totalScans = barcodes.reduce((a, b) => a + b.scan_count, 0);
  const topBarcodes = [...barcodes].sort((a, b) => b.scan_count - a.scan_count).slice(0, 5);
  const byType = barcodes.reduce<Record<string, number>>((acc, b) => {
    acc[b.barcode_type] = (acc[b.barcode_type] || 0) + b.scan_count;
    return acc;
  }, {});
  const bySource = scanLogs.reduce<Record<string, number>>((acc, s) => {
    acc[s.scan_source] = (acc[s.scan_source] || 0) + 1;
    return acc;
  }, {});
  const maxTypeScans = Math.max(...Object.values(byType), 1);
  const maxSourceScans = Math.max(...Object.values(bySource), 1);
  const maxTopScan = Math.max(topBarcodes[0]?.scan_count ?? 1, 1);

  const filteredLogs = scanFilter
    ? scanLogs.filter(s => s.barcode_code === scanFilter)
    : scanLogs;

  const glass = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Barcodes & QR</h1>
        <p className="text-white/60 mb-6">Generate and manage barcodes, QR codes, and scan analytics.</p>

        {/* QR Modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50" onClick={() => setModal(null)}>
            <div className={`${glass} max-w-sm w-full mx-4`} onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-semibold mb-3">{modal.label ?? modal.code}</h3>
              <p className="text-white/50 text-xs mb-3">Type: {modal.barcode_type}</p>
              <div className="bg-white rounded-xl p-6 text-center mb-4">
                <p className="font-mono text-slate-900 text-lg font-bold break-all">{modal.code}</p>
                {modal.url && <p className="text-slate-600 text-xs mt-2 break-all">{modal.url}</p>}
              </div>
              <p className="text-white/40 text-xs mb-4">
                To render this as a visual QR code, paste the code above into any QR generator (e.g. qr-code-generator.com or scan with your device camera pointed at the text above).
              </p>
              <button onClick={() => setModal(null)}
                className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm transition-all">
                Close
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* All Barcodes */}
        {tab === 'All Barcodes' && (
          <div className={glass}>
            {loading ? <p className="text-white/50 text-sm">Loading...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-white/80">
                  <thead>
                    <tr className="text-white/40 text-xs border-b border-white/10">
                      {['Code', 'Type', 'Entity', 'Label', 'Scans', 'Last Scan', 'Active', 'Actions'].map(h => (
                        <th key={h} className="text-left py-2 px-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {barcodes.map(b => (
                      <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 px-3 font-mono text-xs">{b.code}</td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[b.barcode_type] ?? 'bg-white/10 text-white/60'}`}>
                            {b.barcode_type}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ENTITY_COLORS[b.entity_type] ?? 'bg-white/10 text-white/60'}`}>
                            {b.entity_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs">{b.label ?? '—'}</td>
                        <td className="py-2 px-3 font-medium">{b.scan_count}</td>
                        <td className="py-2 px-3 text-xs">
                          {b.last_scanned_at ? new Date(b.last_scanned_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2 px-3">
                          <button onClick={() => toggleActive(b.id, b.is_active)}
                            className={`w-10 h-5 rounded-full transition-all ${b.is_active ? 'bg-green-500' : 'bg-white/20'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white mx-0.5 transition-transform ${b.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </td>
                        <td className="py-2 px-3">
                          {b.barcode_type === 'QR' && (
                            <button onClick={() => setModal(b)}
                              className="text-xs bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 px-2 py-0.5 rounded transition-all">
                              View QR
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!barcodes.length && (
                      <tr><td colSpan={8} className="py-8 text-center text-white/30">No barcodes yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Generate Barcode */}
        {tab === 'Generate Barcode' && (
          <div className={glass}>
            <h2 className="text-lg font-semibold text-white mb-4">Generate New Barcode / QR Code</h2>
            {genMsg && <div className="mb-4 p-3 rounded-lg text-sm bg-red-500/20 text-red-300">{genMsg}</div>}

            {generated && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <p className="text-green-400 text-sm font-medium mb-2">Generated successfully!</p>
                <p className="text-white/70 text-xs mb-1">Code:</p>
                <p className="font-mono text-white text-lg font-bold">{generated.code}</p>
                {generated.url && <p className="text-white/50 text-xs mt-1">URL: {generated.url}</p>}
              </div>
            )}

            <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-white/60 text-xs block mb-1">Barcode Type</label>
                <select value={form.barcode_type} onChange={e => setForm(f => ({ ...f, barcode_type: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400">
                  {['QR', 'EAN13', 'EAN8', 'UPC_A', 'CODE128', 'CODE39', 'DATAMATRIX'].map(t => (
                    <option key={t} value={t} className="bg-slate-800">{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Entity Type</label>
                <select value={form.entity_type} onChange={e => setForm(f => ({ ...f, entity_type: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400">
                  {['product', 'coupon', 'ticket', 'asset', 'location', 'loyalty_card'].map(t => (
                    <option key={t} value={t} className="bg-slate-800">{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Entity ID (optional)</label>
                <input type="number" value={form.entity_id} onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Entity Ref (e.g. YOGA-MAT-001)</label>
                <input type="text" value={form.entity_ref} onChange={e => setForm(f => ({ ...f, entity_ref: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-emerald-400 uppercase" />
              </div>

              <div>
                <label className="text-white/60 text-xs block mb-1">Label</label>
                <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              {form.barcode_type === 'QR' && (
                <div>
                  <label className="text-white/60 text-xs block mb-1">URL (optional — auto-generated if blank)</label>
                  <input type="text" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="/scan/CODE or https://..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-400" />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="text-white/60 text-xs block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              <div className="md:col-span-2">
                <button type="submit" disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                  {saving ? 'Generating...' : 'Generate Barcode'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Scan Logs */}
        {tab === 'Scan Logs' && (
          <div className={glass}>
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <span className="text-white/50 text-xs">Filter by code:</span>
              <select value={scanFilter} onChange={e => setScanFilter(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none">
                <option value="" className="bg-slate-800">All barcodes</option>
                {barcodes.map(b => (
                  <option key={b.id} value={b.code} className="bg-slate-800">{b.code}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white/80">
                <thead>
                  <tr className="text-white/40 text-xs border-b border-white/10">
                    {['Barcode', 'Source', 'Location', 'Scanned At'].map(h => (
                      <th key={h} className="text-left py-2 px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(s => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 px-3 font-mono text-xs">{s.barcode_code}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLORS[s.scan_source] ?? 'bg-white/10 text-white/60'}`}>
                          {s.scan_source}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs">{s.location ?? '—'}</td>
                      <td className="py-2 px-3 text-xs">{new Date(s.scanned_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!filteredLogs.length && (
                    <tr><td colSpan={4} className="py-8 text-center text-white/30">No scan logs.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics */}
        {tab === 'Analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Overview</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Barcodes', value: barcodes.length },
                  { label: 'Total Scans', value: totalScans },
                  { label: 'Active Barcodes', value: barcodes.filter(b => b.is_active).length },
                  { label: 'Avg Scans/Code', value: barcodes.length ? (totalScans / barcodes.length).toFixed(1) : '0' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/50 text-xs">{label}</p>
                    <p className="text-white text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Top 5 Most Scanned</h3>
              <div className="space-y-2">
                {topBarcodes.map((b, i) => (
                  <div key={b.id}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-white/70 font-mono">#{i + 1} {b.code}</span>
                      <span className="text-white">{b.scan_count}</span>
                    </div>
                    <div className="bg-white/10 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(b.scan_count / maxTopScan) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {!topBarcodes.length && <p className="text-white/30 text-sm text-center py-4">No scan data yet.</p>}
              </div>
            </div>

            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Scans by Barcode Type</h3>
              <div className="space-y-2">
                {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, scans]) => (
                  <div key={type}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-white/70">{type}</span>
                      <span className="text-white">{scans}</span>
                    </div>
                    <div className="bg-white/10 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(scans / maxTypeScans) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={glass}>
              <h3 className="text-white font-semibold mb-4">Scans by Source</h3>
              <div className="space-y-2">
                {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                  <div key={source}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-white/70">{source}</span>
                      <span className="text-white">{count}</span>
                    </div>
                    <div className="bg-white/10 rounded-full h-2">
                      <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${(count / maxSourceScans) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {!Object.keys(bySource).length && <p className="text-white/30 text-sm text-center py-4">No scan data.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import */}
        {tab === 'Bulk Import' && (
          <div className={glass}>
            <h2 className="text-lg font-semibold text-white mb-2">Bulk Import Barcodes</h2>
            <p className="text-white/50 text-xs mb-4">
              Enter one barcode per line in CSV format: <span className="font-mono">code, barcode_type, entity_type, label</span>
              <br />Example: <span className="font-mono">YOGA-001, QR, product, Yoga Mat Premium</span>
            </p>

            {bulkResult && <div className="mb-4 p-3 rounded-lg text-sm bg-blue-500/20 text-blue-300">{bulkResult}</div>}

            <textarea
              value={csvInput}
              onChange={e => { setCsvInput(e.target.value); parseCSV(e.target.value); }}
              rows={8}
              placeholder="YOGA-001, QR, product, Yoga Mat Premium&#10;BLOCK-A, QR, location, Studio A&#10;COUPON-SUMMER, CODE128, coupon, Summer Discount"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-white/30 focus:outline-none focus:border-emerald-400 mb-4"
            />

            {csvPreview.length > 0 && (
              <div className="mb-4">
                <p className="text-white/60 text-xs mb-2">Preview ({csvPreview.length} rows):</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-white/70">
                    <thead>
                      <tr className="text-white/40 border-b border-white/10">
                        {['Code', 'Type', 'Entity', 'Label'].map(h => (
                          <th key={h} className="text-left py-1.5 px-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-1.5 px-3 font-mono">{row.code}</td>
                          <td className="py-1.5 px-3">{row.barcode_type}</td>
                          <td className="py-1.5 px-3">{row.entity_type}</td>
                          <td className="py-1.5 px-3">{row.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.length > 10 && <p className="text-white/30 text-xs mt-1 px-3">...and {csvPreview.length - 10} more</p>}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleBulkImport}
                disabled={bulkImporting || !csvPreview.length}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                {bulkImporting ? 'Importing...' : `Import ${csvPreview.length} Barcodes`}
              </button>
              {csvPreview.length > 0 && (
                <button onClick={() => { setCsvInput(''); setCsvPreview([]); }}
                  className="bg-white/10 hover:bg-white/20 text-white/70 px-4 py-2 rounded-lg text-sm transition-all">
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
