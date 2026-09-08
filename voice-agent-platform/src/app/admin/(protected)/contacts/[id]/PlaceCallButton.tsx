'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface VersionOption {
  versionId: string;
  scriptName: string;
  versionNumber: number;
}

/**
 * Places a REAL outbound call via POST /api/admin/calls/place. This rings a
 * real phone -- the browser confirm() below is the explicit human
 * confirmation step this project requires before any real-world side
 * effect, naming the exact number that will be called.
 */
export default function PlaceCallButton({
  contactId, contactPhone, callable, versions,
}: {
  contactId: string;
  contactPhone: string | null;
  callable: boolean;
  versions: VersionOption[];
}) {
  const router = useRouter();
  const [versionId, setVersionId] = useState(versions[0]?.versionId ?? '');
  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (!contactPhone) {
    return <p className="text-sm opacity-60">No phone number on file -- cannot place a call.</p>;
  }
  if (!callable) {
    return <p className="text-sm opacity-60">This contact's status blocks calling (do_not_call / archived).</p>;
  }
  if (versions.length === 0) {
    return (
      <p className="text-sm opacity-60">
        No script version is synced to Vapi yet. Sync one from a script&apos;s detail page first.
      </p>
    );
  }

  async function placeCall() {
    const confirmed = window.confirm(
      `This will place a REAL phone call to ${contactPhone} right now. Continue?`
    );
    if (!confirmed) return;

    setPlacing(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/calls/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, scriptVersionId: versionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Failed: ${data.error ?? res.statusText}`);
      } else {
        setResult(`Call placed. Provider status: ${data.providerStatus}`);
        router.refresh();
      }
    } catch (err) {
      setResult(`Failed: ${err instanceof Error ? err.message : 'network error'}`);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="space-y-2 border border-black/10 dark:border-white/10 rounded-lg p-4">
      <label className="text-sm font-medium block">Place a real outbound call</label>
      <select
        value={versionId}
        onChange={(e) => setVersionId(e.target.value)}
        disabled={placing}
        className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent"
      >
        {versions.map((v) => (
          <option key={v.versionId} value={v.versionId}>{v.scriptName} (v{v.versionNumber})</option>
        ))}
      </select>
      <button
        onClick={placeCall}
        disabled={placing}
        className="w-full bg-red-600 text-white rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {placing ? 'Calling…' : `Call ${contactPhone} now`}
      </button>
      {result && <p className="text-sm">{result}</p>}
    </div>
  );
}
