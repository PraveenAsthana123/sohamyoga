'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';

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

  // Real QR Kiosk Login -- qr_login_challenge table + v_active_qr_challenges
  // view existed with zero API route anywhere; this created a fake in-memory
  // challenge and polled nothing. Now calls the real create/status/approve
  // endpoints built alongside this fix.
  const createChallenge = useCallback(async () => {
    setStatus('loading');
    try {
      const deviceHint = typeof window !== 'undefined'
        ? `${navigator.userAgent.split(' ').pop()?.split('/')[0] ?? 'Browser'} / ${window.location.hostname}`
        : 'This device';
      const res = await fetch('/api/auth/qr-challenge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceHint }),
      });
      if (!res.ok) throw new Error('Failed to create challenge');
      const data: ChallengeData = await res.json();
      setChallenge(data);
      setStatus('pending');
      setSecondsLeft(Math.max(0, Math.round((new Date(data.expiresAt).getTime() - Date.now()) / 1000)));

      await generateQrDataUrl(
        `${window.location.origin}/auth/confirm-qr?token=${data.challengeToken}`
      );
    } catch {
      setStatus('error');
    }
  }, []);

  const generateQrDataUrl = async (text: string) => {
    // Real, scannable QR encoding via the `qrcode` library -- previously
    // a fake hash-derived grid that looked QR-like but encoded nothing;
    // no phone camera could ever have scanned it.
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        width: 240,
        margin: 2,
        color: { dark: '#052e16', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
      setQrDataUrl(dataUrl);
    } catch { /* qrcode generation unavailable */ }
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

  // Poll for approval against the real challenge status.
  useEffect(() => {
    if (status !== 'pending' || !challenge) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr-challenge/${challenge.challengeToken}/status`);
        if (!res.ok) return;
        const d = await res.json();
        if (d.status === 'approved') {
          clearInterval(pollRef.current!);
          setStatus('approved');
          onApproved?.();
        } else if (d.status === 'expired' || d.status === 'rejected') {
          clearInterval(pollRef.current!);
          setStatus('expired');
          onExpired?.();
        }
      } catch { /* ignore poll errors */ }
    }, 2000);
    return () => clearInterval(pollRef.current!);
  }, [status, challenge, onApproved, onExpired]);

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
        <p className="text-green-300 font-bold text-lg">Approved on your phone!</p>
        <p className="text-white/60 text-sm">
          Automatic sign-in handoff to this screen isn&apos;t available yet — please{' '}
          <a href="/customer/login" className="text-green-400 underline">sign in here directly</a>.
        </p>
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
