'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type CheckInResult =
  | 'valid' | 'already_scanned' | 'wrong_class' | 'too_early'
  | 'expired_membership' | 'no_credits' | 'cancelled' | 'unknown_token'
  | 'offline_queued' | 'manual_override';

interface ScanResult {
  token:         string;
  result:        CheckInResult;
  customerName:  string;
  message:       string;
  scannedAt:     Date;
}

const RESULT_CONFIG: Record<CheckInResult, { color: string; bg: string; icon: string; action: 'allow' | 'warn' | 'reject' }> = {
  valid:              { color: 'text-green-300',  bg: 'bg-green-500/20  border-green-500/40',  icon: '✅', action: 'allow'  },
  already_scanned:    { color: 'text-amber-300',  bg: 'bg-amber-500/20  border-amber-500/40',  icon: '⚠️', action: 'warn'   },
  wrong_class:        { color: 'text-red-300',    bg: 'bg-red-500/20    border-red-500/40',    icon: '❌', action: 'reject' },
  too_early:          { color: 'text-amber-300',  bg: 'bg-amber-500/20  border-amber-500/40',  icon: '⏰', action: 'warn'   },
  expired_membership: { color: 'text-red-300',    bg: 'bg-red-500/20    border-red-500/40',    icon: '🚫', action: 'reject' },
  no_credits:         { color: 'text-red-300',    bg: 'bg-red-500/20    border-red-500/40',    icon: '📭', action: 'reject' },
  cancelled:          { color: 'text-red-300',    bg: 'bg-red-500/20    border-red-500/40',    icon: '🗑️', action: 'reject' },
  unknown_token:      { color: 'text-red-300',    bg: 'bg-red-500/20    border-red-500/40',    icon: '🔍', action: 'reject' },
  offline_queued:     { color: 'text-blue-300',   bg: 'bg-blue-500/20   border-blue-500/40',   icon: '📶', action: 'warn'   },
  manual_override:    { color: 'text-purple-300', bg: 'bg-purple-500/20 border-purple-500/40', icon: '🔓', action: 'allow'  },
};

interface QrCheckInScannerProps {
  classId:   string;
  className?: string;
}

export default function QrCheckInScanner({ classId, className = '' }: QrCheckInScannerProps) {
  const [scanning,     setScanning]     = useState(false);
  const [lastResult,   setLastResult]   = useState<ScanResult | null>(null);
  const [scanHistory,  setScanHistory]  = useState<ScanResult[]>([]);
  const [manualToken,  setManualToken]  = useState('');
  const [showManual,   setShowManual]   = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<string[]>([]);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);

  const processToken = useCallback(async (token: string): Promise<ScanResult> => {
    // TODO: POST /api/checkin/validate with { token, classId }
    // Simulated response for development:
    await new Promise((r) => setTimeout(r, 300));

    const mockResult: CheckInResult =
      token.startsWith('tk_valid') ? 'valid' :
      token.startsWith('tk_early') ? 'too_early' :
      token.startsWith('tk_dup')   ? 'already_scanned' :
      'unknown_token';

    return {
      token,
      result:       mockResult,
      customerName: mockResult === 'valid' ? 'Ananya Krishnan' : 'Unknown',
      message:      {
        valid:              'Check-in recorded. Welcome!',
        already_scanned:    `Already checked in at ${new Date().toLocaleTimeString()}`,
        wrong_class:        'QR is for a different class.',
        too_early:          'Class hasn\'t started yet.',
        expired_membership: 'Membership has expired. Please renew.',
        no_credits:         'No remaining class credits.',
        cancelled:          'This booking was cancelled.',
        unknown_token:      'Unrecognised QR code.',
        offline_queued:     'Queued — will sync when online.',
        manual_override:    'Manual override recorded.',
      }[mockResult],
      scannedAt: new Date(),
    };
  }, [classId]);

  const handleScan = useCallback(async (token: string) => {
    if (!token.trim()) return;
    const result = await processToken(token.trim());
    setLastResult(result);
    setScanHistory((h) => [result, ...h].slice(0, 50));
  }, [processToken]);

  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    setScanning(true);

    try {
      // Dynamic import — html5-qrcode is DOM-only
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-scanner-region');
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          // Extract token from full URL if present
          const token = decodedText.includes('/checkin/')
            ? decodedText.split('/checkin/').pop() ?? decodedText
            : decodedText;
          await handleScan(token);
        },
        undefined // ignore per-frame errors
      );
    } catch (err) {
      console.warn('QR scanner start failed:', err);
      setScanning(false);
    }
  }, [handleScan]);

  const stopScanner = useCallback(async () => {
    if (html5QrRef.current) {
      const scanner = html5QrRef.current as { stop: () => Promise<void>; clear: () => void };
      try { await scanner.stop(); scanner.clear(); } catch { /* ignore */ }
      html5QrRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  const syncOfflineQueue = async () => {
    for (const token of offlineQueue) await handleScan(token);
    setOfflineQueue([]);
  };

  const last = lastResult ? RESULT_CONFIG[lastResult.result] : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Scanner viewport */}
      <div className="glass-dark rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold">QR Check-In Scanner</h3>
            <p className="text-white/45 text-xs">Class: {classId}</p>
          </div>
          <div className="flex gap-2">
            {!scanning ? (
              <button
                onClick={startScanner}
                className="px-4 py-2 rounded-xl bg-green-400 text-green-950 font-bold text-sm
                           hover:bg-green-300 transition-colors"
              >
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="px-4 py-2 rounded-xl bg-red-500/30 text-red-300 font-bold text-sm
                           hover:bg-red-500/50 transition-colors"
              >
                Stop
              </button>
            )}
            <button
              onClick={() => setShowManual((s) => !s)}
              className="px-4 py-2 rounded-xl glass text-white/70 text-sm hover:text-white transition-colors"
            >
              Manual
            </button>
          </div>
        </div>

        {/* Camera area */}
        <div className="relative bg-black" style={{ minHeight: 280 }}>
          <div id="qr-scanner-region" ref={scannerRef} className="w-full" />
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/40">
              <div className="text-5xl">📷</div>
              <p className="text-sm">Tap "Start Camera" to begin scanning</p>
            </div>
          )}
        </div>

        {/* Manual entry */}
        {showManual && (
          <div className="p-4 border-t border-white/10 flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste token or booking ref…"
              className="flex-1 px-3 py-2 rounded-xl bg-white/8 border border-white/15 text-white
                         placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/50"
              onKeyDown={(e) => { if (e.key === 'Enter') { handleScan(manualToken); setManualToken(''); } }}
            />
            <button
              onClick={() => { handleScan(manualToken); setManualToken(''); }}
              className="px-4 py-2 rounded-xl bg-green-400 text-green-950 font-bold text-sm"
            >
              Check In
            </button>
          </div>
        )}
      </div>

      {/* Last scan result */}
      {lastResult && last && (
        <div className={`rounded-2xl border p-4 ${last.bg}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{last.icon}</span>
            <div className="flex-1">
              <div className={`font-bold text-base ${last.color}`}>
                {lastResult.customerName}
              </div>
              <div className="text-white/70 text-sm">{lastResult.message}</div>
              <div className="text-white/35 text-xs mt-0.5">
                {lastResult.scannedAt.toLocaleTimeString()} · {lastResult.token.slice(0, 16)}…
              </div>
            </div>
            <span className={`yoga-tag font-bold ${
              last.action === 'allow'  ? 'bg-green-400/20 text-green-300' :
              last.action === 'warn'   ? 'bg-amber-400/20 text-amber-300' :
                                         'bg-red-400/20   text-red-300'
            }`}>
              {last.action.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Offline queue banner */}
      {offlineQueue.length > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 flex items-center justify-between">
          <span className="text-blue-300 text-sm">
            📶 {offlineQueue.length} scans queued offline
          </span>
          <button onClick={syncOfflineQueue} className="text-blue-300 text-xs font-bold hover:text-blue-200">
            Sync now
          </button>
        </div>
      )}

      {/* Scan history */}
      {scanHistory.length > 0 && (
        <div className="glass-dark rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h4 className="text-white font-semibold text-sm">Recent Scans</h4>
            <span className="text-white/40 text-xs">{scanHistory.length} total</span>
          </div>
          <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
            {scanHistory.slice(0, 20).map((s, i) => {
              const cfg = RESULT_CONFIG[s.result];
              return (
                <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-lg">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white/85 text-sm font-medium truncate">{s.customerName}</div>
                    <div className="text-white/35 text-xs">{s.scannedAt.toLocaleTimeString()}</div>
                  </div>
                  <span className={`yoga-tag text-[10px] ${cfg.color} bg-white/5`}>
                    {s.result.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
