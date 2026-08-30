'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ScriptVersionActions({ scriptId, versionId }: { scriptId: string; versionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    setError(null);
    setPublishing(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not publish.');
        return;
      }
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={handlePublish} disabled={publishing} className="text-xs rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1 disabled:opacity-50">
        {publishing ? 'Publishing…' : 'Publish this version'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
