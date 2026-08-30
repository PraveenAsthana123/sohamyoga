'use client';
// Module 16 — Review, Rating & Reputation Management (Google Business Profile
// slice). Was 3/13: zero review/rating persistence anywhere. This is a real
// OAuth-gated Google Business Profile integration: credential entry, connect
// flow, real review sync, real reply posting back to Google. Credential-gated
// like every other Google connector in this repo -- honestly shows
// "not connected" until a real account is linked, never fabricates reviews.

import { useEffect, useState, useCallback } from 'react';

interface CredStatus { authStatus: string; hasClientCredentials: boolean; locationDisplayName: string | null; lastSyncedAt: string | null; lastFailureMessage: string | null }
interface Review { id: string; reviewerName: string; starRating: number | null; comment: string | null; createdAt: string | null; replyText: string | null }

export default function ReputationAdmin() {
  const [status, setStatus] = useState<CredStatus | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [clientId, setClientId] = useState(''); const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    fetch('/api/admin/reputation/credentials', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setStatus);
    fetch('/api/admin/reputation/reviews', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setReviews(d?.reviews ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauthSuccess')) setMessage('Connected to Google Business Profile.');
    if (params.get('oauthError')) setMessage(`OAuth failed: ${params.get('oauthError')}`);
  }, []);

  async function saveCredentials() {
    setBusy(true); setMessage(null);
    const res = await fetch('/api/admin/reputation/credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setClientId(''); setClientSecret(''); load(); }
    else setMessage(body.error ?? 'Failed to save credentials.');
  }

  async function sync() {
    setBusy(true); setMessage(null);
    const res = await fetch('/api/admin/reputation/sync', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? `Synced ${body.reviewsSynced} review(s).` : (body.error ?? 'Sync failed.'));
    load();
  }

  async function sendReply(id: string) {
    const comment = replyDrafts[id]?.trim();
    if (!comment) return;
    const res = await fetch(`/api/admin/reputation/reviews/${id}/reply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment }),
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Reply posted to Google.' : (body.error ?? 'Reply failed.'));
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Review, Rating & Reputation Management</h1>
      <p className="text-sm text-gray-500 mb-6">Real Google Business Profile integration — connect, sync, and reply to real reviews.</p>

      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-gray-800">
            Connection status: <span className={status?.authStatus === 'active' ? 'text-green-600' : 'text-amber-600'}>{status?.authStatus ?? 'loading…'}</span>
          </p>
          {status?.authStatus === 'active' && (
            <button onClick={sync} disabled={busy} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Sync reviews now</button>
          )}
        </div>
        {status?.locationDisplayName && <p className="text-xs text-gray-500">Location: {status.locationDisplayName}</p>}
        {status?.lastSyncedAt && <p className="text-xs text-gray-400">Last synced: {new Date(status.lastSyncedAt).toLocaleString()}</p>}
        {status?.lastFailureMessage && <p className="text-xs text-red-500 mt-1">Last error: {status.lastFailureMessage}</p>}
        {message && <p className="text-xs text-indigo-600 mt-2">{message}</p>}

        {status?.authStatus !== 'active' && (
          <div className="mt-4 space-y-2 max-w-md">
            <p className="text-xs text-gray-500">
              Requires a Google Cloud project with the Business Profile API enabled (Google gates this via manual approval — not self-serve).
            </p>
            <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Google OAuth Client ID" className="w-full border rounded px-2 py-1.5 text-sm" />
            <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} type="password" placeholder="Google OAuth Client Secret" className="w-full border rounded px-2 py-1.5 text-sm" />
            <div className="flex gap-2">
              <button onClick={saveCredentials} disabled={busy || !clientId || !clientSecret} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Save credentials</button>
              {status?.hasClientCredentials && (
                <a href="/api/admin/reputation/oauth/start" className="px-3 py-1.5 bg-green-600 text-white rounded text-sm text-center">Connect via Google</a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <h3 className="font-semibold text-gray-800 p-4 pb-0">Reviews ({reviews.length})</h3>
        <div className="divide-y">
          {reviews.map(r => (
            <div key={r.id} className="p-4">
              <div className="flex justify-between">
                <p className="font-medium text-gray-800">{r.reviewerName}</p>
                <p className="text-amber-500">{'★'.repeat(r.starRating ?? 0)}{'☆'.repeat(5 - (r.starRating ?? 0))}</p>
              </div>
              {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
              <p className="text-xs text-gray-400 mt-1">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</p>
              {r.replyText ? (
                <p className="text-xs bg-gray-50 rounded p-2 mt-2 text-gray-600">Your reply: {r.replyText}</p>
              ) : (
                <div className="flex gap-2 mt-2">
                  <input
                    value={replyDrafts[r.id] ?? ''}
                    onChange={e => setReplyDrafts(d => ({ ...d, [r.id]: e.target.value }))}
                    placeholder="Write a reply…" className="flex-1 border rounded px-2 py-1 text-xs"
                  />
                  <button onClick={() => sendReply(r.id)} className="text-xs text-indigo-600 hover:underline">Post reply</button>
                </div>
              )}
            </div>
          ))}
          {!reviews.length && <p className="text-sm text-gray-400 text-center py-6">No reviews synced yet.</p>}
        </div>
      </div>
    </div>
  );
}
