'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SyncLogEntry {
  id: string; action: 'create' | 'update'; success: boolean; assistantId: string | null;
  errorMessage: string | null; durationMs: number; initiatedBy: string; createdAt: string;
}

export default function SyncToVapiButton({
  scriptId, versionId, vapiAssistantId, vapiSyncedAt, vapiSyncError,
}: {
  scriptId: string; versionId: string;
  vapiAssistantId: string | null; vapiSyncedAt: string | null; vapiSyncError: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(vapiSyncError);
  const [syncing, setSyncing] = useState(false);
  const [history, setHistory] = useState<SyncLogEntry[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function handleSync() {
    setError(null);
    setSyncing(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/versions/${versionId}/sync-vapi`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not sync to Vapi.');
        if (history) loadHistory();
        return;
      }
      router.refresh();
      if (history) loadHistory();
    } finally {
      setSyncing(false);
    }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/versions/${versionId}/sync-vapi/history`);
      if (res.ok) setHistory(await res.json());
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={handleSync} disabled={syncing} className="text-xs rounded border border-black/20 dark:border-white/20 px-3 py-1 disabled:opacity-50">
          {syncing ? 'Syncing…' : vapiAssistantId ? 'Re-sync to Vapi' : 'Sync to Vapi'}
        </button>
        {vapiAssistantId && vapiSyncedAt && (
          <span className="text-xs opacity-60">assistant {vapiAssistantId.slice(0, 8)}… · synced {new Date(vapiSyncedAt).toLocaleString()}</span>
        )}
        <button onClick={() => (history ? setHistory(null) : loadHistory())} disabled={loadingHistory} className="text-xs opacity-60 underline">
          {history ? 'hide sync history' : loadingHistory ? 'loading…' : 'sync history'}
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {history && (
        <div className="mt-1 space-y-1 border-l-2 border-black/10 dark:border-white/10 pl-2">
          {history.length === 0 && <p className="text-xs opacity-50">No sync attempts yet.</p>}
          {history.map(h => (
            <div key={h.id} className="text-xs">
              <span className={h.success ? 'text-green-600' : 'text-red-600'}>{h.success ? 'ok' : 'fail'}</span>
              {' '}· {h.action} · {h.durationMs}ms · {h.initiatedBy} · {new Date(h.createdAt).toLocaleString()}
              {h.errorMessage && <span className="opacity-60"> — {h.errorMessage}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
