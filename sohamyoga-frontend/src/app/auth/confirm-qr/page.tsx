'use client';
// /auth/confirm-qr -- the mobile side of QR Kiosk Login. Requires the
// customer to already be signed in on THIS device (that's the trust
// anchor); approving here records real approval against the real
// qr_login_challenge row the kiosk created.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Status = 'checking' | 'ready' | 'approving' | 'approved' | 'error';

export default function ConfirmQrPage() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setError('Missing QR token.'); return; }
    setStatus('ready');
  }, [token]);

  async function approve() {
    if (!token) return;
    setStatus('approving');
    const res = await fetch(`/api/auth/qr-challenge/${token}/approve`, { method: 'POST' });
    if (res.status === 401) { setStatus('error'); setError('Please sign in on this device first, then scan again.'); return; }
    const body = await res.json();
    if (!res.ok) { setStatus('error'); setError(body.error || 'Approval failed.'); return; }
    setStatus('approved');
  }

  return (
    <main className="min-h-screen bg-yoga-hero flex items-center justify-center p-4">
      <div className="glass-dark p-8 rounded-2xl w-full max-w-sm text-center space-y-4">
        {status === 'checking' && <p className="text-white/60 text-sm">Loading…</p>}
        {status === 'ready' && (
          <>
            <div className="text-4xl">📷</div>
            <h1 className="text-xl font-bold text-white">Sign in on another device?</h1>
            <p className="text-white/60 text-sm">Approve only if you just scanned this QR code yourself on a kiosk or shared screen.</p>
            <button onClick={approve} className="w-full py-3 rounded-xl bg-green-400 text-green-950 font-bold hover:bg-green-300 transition-colors">
              Approve Sign-In
            </button>
          </>
        )}
        {status === 'approving' && <p className="text-white/60 text-sm">Approving…</p>}
        {status === 'approved' && (
          <>
            <div className="text-4xl">✅</div>
            <h1 className="text-xl font-bold text-white">Approved</h1>
            <p className="text-white/60 text-sm">
              The other device has been notified. Automatic sign-in handoff isn&apos;t available yet on that
              screen — it will need to sign in normally, but this approval is now on record.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl">⚠️</div>
            <p className="text-red-300 text-sm">{error}</p>
          </>
        )}
      </div>
    </main>
  );
}
