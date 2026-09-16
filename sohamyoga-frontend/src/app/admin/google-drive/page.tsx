'use client';

import { useEffect, useState } from 'react';

interface DriveConnection {
  id: string;
  account_email: string;
  connection_name: string | null;
  status: string;
  scopes: string[];
  last_sync_at: string | null;
  created_at: string;
  access_token_masked: string;
}

interface DriveFile {
  id: string;
  connection_id: string;
  drive_file_id: string;
  name: string;
  mime_type: string;
  web_view_link: string;
  web_content_link: string;
  size_bytes: number;
  folder_path: string;
  category: string;
  synced_at: string;
  account_email: string;
}

const STATUS_COLOR: Record<string, string> = {
  connected: 'bg-green-100 text-green-700',
  disconnected: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700',
};

const CATEGORY_COLOR: Record<string, string> = {
  brochure: 'bg-blue-100 text-blue-700',
  contract: 'bg-purple-100 text-purple-700',
  report: 'bg-amber-100 text-amber-700',
  asset: 'bg-green-100 text-green-700',
  uncategorized: 'bg-gray-100 text-gray-600',
};

function mimeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '📸';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  return '📄';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TABS = ['Connected Accounts', 'File Browser', 'Settings'] as const;
type Tab = typeof TABS[number];

const CATEGORIES = ['uncategorized', 'brochure', 'contract', 'report', 'asset'];
const SYNC_FREQUENCIES = ['15 minutes', '1 hour', 'Daily'];

export default function GoogleDrivePage() {
  const [tab, setTab] = useState<Tab>('Connected Accounts');
  const [connections, setConnections] = useState<DriveConnection[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState('');
  const [autoCateg, setAutoCateg] = useState(true);
  const [syncFreq, setSyncFreq] = useState('1 hour');
  const [folderRule, setFolderRule] = useState('/Marketing, /Contracts, /Reports');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/google-drive', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to load.'); return; }
      setConnections(data.connections ?? []);
      setFiles(data.files ?? []);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function syncNow(connectionId: string) {
    setSyncingId(connectionId);
    setSyncMsg('');
    try {
      const res = await fetch('/api/admin/google-drive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const data = await res.json();
      setSyncMsg(data.message ?? 'Sync complete.');
      load();
    } catch {
      setSyncMsg('Sync failed.');
    } finally {
      setSyncingId(null);
    }
  }

  async function updateCategory(fileId: string, category: string) {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, category } : f));
    // In a real impl: PATCH /api/admin/google-drive/files/[id]
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Google Drive Integration</h1>
          <p className="mt-1 text-sm text-gray-500">Manage connected Drive accounts and synced files.</p>
        </div>
        <a
          href="/api/auth/google?scope=drive"
          onClick={e => { e.preventDefault(); window.location.href = '/api/auth/google?scope=drive'; }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Connect New Account
        </a>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {syncMsg && <p className="rounded bg-green-50 p-3 text-sm text-green-700">{syncMsg}</p>}

      {/* Tab: Connected Accounts */}
      {tab === 'Connected Accounts' && !loading && (
        <div className="space-y-4">
          {connections.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No Drive accounts connected yet.{' '}
              <button
                onClick={() => { window.location.href = '/api/auth/google?scope=drive'; }}
                className="text-blue-600 underline"
              >
                Connect one now
              </button>
            </div>
          )}
          {connections.map(conn => (
            <div key={conn.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">☁️</span>
                    <div>
                      <p className="font-semibold text-gray-900">{conn.connection_name ?? 'Unnamed Connection'}</p>
                      <p className="text-sm text-gray-500">{conn.account_email}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[conn.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {conn.status}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-gray-500">
                    <span>Scopes: {conn.scopes?.join(', ')}</span>
                    <span>Token: {conn.access_token_masked}</span>
                    <span>Last sync: {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString() : 'Never'}</span>
                  </div>
                </div>
                <button
                  onClick={() => syncNow(conn.id)}
                  disabled={syncingId === conn.id}
                  className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  {syncingId === conn.id ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: File Browser */}
      {tab === 'File Browser' && !loading && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">File</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Size</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Folder</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Synced</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {files.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{mimeIcon(f.mime_type)}</span>
                      <div>
                        <p className="font-medium text-gray-900">{f.name}</p>
                        <p className="text-xs text-gray-400">{f.account_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatBytes(f.size_bytes)}</td>
                  <td className="px-4 py-3 text-gray-600">{f.folder_path}</td>
                  <td className="px-4 py-3">
                    <select
                      value={f.category}
                      onChange={e => updateCategory(f.id, e.target.value)}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CATEGORY_COLOR[f.category] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(f.synced_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <a href={f.web_view_link} target="_blank" rel="noopener noreferrer"
                        className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200">
                        Open
                      </a>
                      <a href={f.web_content_link} target="_blank" rel="noopener noreferrer"
                        className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100">
                        Download
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No files synced yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Settings */}
      {tab === 'Settings' && (
        <div className="max-w-xl space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">Sync Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Folder Sync Rules</label>
                <input
                  type="text"
                  value={folderRule}
                  onChange={e => setFolderRule(e.target.value)}
                  placeholder="/Marketing, /Contracts"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Comma-separated folder paths to include in sync.</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Sync Frequency</label>
                <select
                  value={syncFreq}
                  onChange={e => setSyncFreq(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SYNC_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Auto-Categorization</p>
                  <p className="text-xs text-gray-500">Automatically classify files into brochure, contract, report, asset.</p>
                </div>
                <button
                  onClick={() => setAutoCateg(v => !v)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${autoCateg ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoCateg ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            <button className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Save Settings
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 font-semibold text-gray-900">OAuth Configuration</h2>
            <p className="text-sm text-gray-600">Drive integration uses Google OAuth 2.0. Configure your credentials in the environment:</p>
            <div className="mt-3 space-y-1 rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-700">
              <p>GOOGLE_CLIENT_ID=your_client_id</p>
              <p>GOOGLE_CLIENT_SECRET=your_client_secret</p>
              <p>GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
