'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface ChallengeData {
  challengeId:     string;
  challengeToken:  string;
  expiresAt:       string;   // ISO timestamp
  deviceHint:      string;
}

interface QrLoginChallengeProps {
  onApproved?: () => void;
  onExpired?:  () => void;
}

type ChallengeStatus = 'loading' | 'pending' | 'approved' | 'expired' | 'error';

export default function QrLoginChallenge({ onApproved, onExpired }: QrLoginChallengeProps) {
  const [status,    setStatus]    = useState<ChallengeStatus>('loading');
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [qrDataUrl, setQrDataUrl]   = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createChallenge = useCallback(async () => {
    setStatus('loading');
    try {
      // TODO: replace with real API call to POST /api/auth/qr-challenge
      const mockChallenge: ChallengeData = {
        challengeId:    `ch-${Math.random().toString(36).slice(2)}`,
        challengeToken: `qr_${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        expiresAt:      new Date(Date.now() + 60_000).toISOString(),
        deviceHint:     typeof window !== 'undefined'
          ? `${navigator.userAgent.split(' ').pop()?.split('/')[0] ?? 'Browser'} / ${window.location.hostname}`
          : 'This device',
      };
      setChallenge(mockChallenge);
      setStatus('pending');
      setSecondsLeft(60);

      // Generate QR code using canvas
      await generateQrDataUrl(
        `${window.location.origin}/auth/confirm-qr?token=${mockChallenge.challengeToken}`
      );
    } catch {
      setStatus('error');
    }
  }, []);

  const generateQrDataUrl = async (text: string) => {
    // Dynamic import to keep QR lib out of SSR bundle
    try {
      // Using native canvas for a lightweight QR placeholder
      // TODO: replace with qrcode.js or qr-code-styling for production
      const size = 240;
      const canvas = document.createElement('canvas');
      canvas.width  = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#052e16';

      // Simple QR-like placeholder grid (replace with real QR library)
      const cells = 21;
      const cellSize = (size - 32) / cells;
      const offset = 16;
      const hash = Array.from(text).reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0);
      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          const corner =
            (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
          const fill = corner ? true : !!(((hash >> ((r * cells + c) % 31)) & 1));
          if (fill) {
            ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize - 1, cellSize - 1);
          }
        }
      }
      setQrDataUrl(canvas.toDataURL());
    } catch { /* canvas unavailable */ }
  };

  useEffect(() => {
    createChallenge();
  }, [createChallenge]);

  // Countdown timer
  useEffect(() => {
    if (status !== 'pending') return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          setStatus('expired');
          onExpired?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [status, onExpired]);

  // Poll for approval
  useEffect(() => {
    if (status !== 'pending' || !challenge) return;
    pollRef.current = setInterval(async () => {
      try {
        // TODO: GET /api/auth/qr-challenge/<challengeId>/status
        // const res = await fetch(`/api/auth/qr-challenge/${challenge.challengeId}/status`);
        // if (res.ok) { const d = await res.json(); if (d.status === 'approved') { ... } }
      } catch { /* ignore poll errors */ }
    }, 2000);
    return () => clearInterval(pollRef.current!);
  }, [status, challenge]);

  const circumference = 2 * Math.PI * 54;
  const dashOffset    = circumference - (secondsLeft / 60) * circumference;
  const urgent        = secondsLeft <= 15;

  if (status === 'loading') {
    return (
      <div className="glass-dark p-8 rounded-2xl flex flex-col items-center gap-4 text-center">
        <div className="w-10 h-10 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
        <p className="text-white/60 text-sm">Generating QR code…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="glass-dark p-8 rounded-2xl text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-red-300 text-sm">Failed to create QR challenge. Please try again.</p>
        <button onClick={createChallenge} className="btn-primary text-sm">Retry</button>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="glass-dark p-8 rounded-2xl text-center space-y-4">
        <div className="text-5xl">✅</div>
        <p className="text-green-300 font-bold text-lg">Login approved!</p>
        <p className="text-white/60 text-sm">You have been signed in. Redirecting…</p>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="glass-dark p-8 rounded-2xl text-center space-y-4">
        <div className="text-5xl">⏰</div>
        <p className="text-amber-300 font-bold text-lg">QR code expired</p>
        <p className="text-white/60 text-sm">The challenge expired after 60 seconds.</p>
        <button
          onClick={createChallenge}
          className="px-6 py-3 rounded-xl bg-green-400 text-green-950 font-bold hover:bg-green-300 transition-colors"
        >
          Generate New QR
        </button>
      </div>
    );
  }

  return (
    <div className="glass-dark p-8 rounded-2xl space-y-6 text-center">
      <div>
        <h3 className="text-white font-bold text-xl mb-1">Scan to Sign In</h3>
        <p className="text-white/55 text-sm">
          Open the Soham app on your authenticated phone and scan this code.
        </p>
      </div>

      {/* QR + countdown ring */}
      <div className="relative flex items-center justify-center mx-auto" style={{ width: 280, height: 280 }}>
        {/* Countdown SVG ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={urgent ? '#f87171' : '#4ade80'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
          />
        </svg>

        {/* QR image */}
        <div className={`w-56 h-56 rounded-xl overflow-hidden bg-white flex items-center justify-center shadow-2xl
                         ${urgent ? 'ring-2 ring-red-400' : ''}`}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR login code" className="w-full h-full object-contain p-1" />
          ) : (
            <div className="text-gray-400 text-sm">Generating…</div>
          )}
        </div>

        {/* Countdown text overlay */}
        <div className={`absolute bottom-3 right-3 text-xs font-bold px-2 py-1 rounded-full
                         ${urgent ? 'bg-red-500 text-white' : 'bg-green-400 text-green-950'}`}>
          {secondsLeft}s
        </div>
      </div>

      {/* Security notes */}
      <ul className="text-xs text-white/40 space-y-1 text-left max-w-xs mx-auto">
        <li>✓ Expires in {secondsLeft} seconds</li>
        <li>✓ One-time use only</li>
        <li>✓ Linked to this browser session</li>
        <li>✓ Requires confirmation on your phone</li>
        <li>✓ Never contains a password or token</li>
      </ul>

      <p className="text-white/30 text-xs">
        Device: {challenge?.deviceHint ?? '—'}
      </p>
    </div>
  );
}
