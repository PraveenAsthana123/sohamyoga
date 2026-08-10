'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { maskProperties } from '@/lib/analytics-masking';
import { CONSENT_KEY, CONSENT_EVENT, type ConsentLevel } from './ConsentBanner';

// ── Consent hierarchy ─────────────────────────────────────────────────────────

const HIERARCHY: ConsentLevel[] = ['none', 'essential', 'analytics', 'marketing', 'all'];

function meetsLevel(current: ConsentLevel, required: ConsentLevel): boolean {
  return HIERARCHY.indexOf(current) >= HIERARCHY.indexOf(required);
}

// ── Anonymous ID — persists across page loads, never tied to PII ──────────────

let _anonId: string | undefined;

function anonymousId(): string {
  if (_anonId) return _anonId;
  if (typeof window === 'undefined') return 'ssr';
  const stored = localStorage.getItem('slp_anon_id');
  if (stored) { _anonId = stored; return stored; }
  // Monotonic counter + entropy component — no Date.now() (SSR-safe)
  const id = `anon-${Math.random().toString(36).slice(2, 10)}-${performance.now().toString(36).replace('.', '')}`;
  localStorage.setItem('slp_anon_id', id);
  _anonId = id;
  return id;
}

// ── Event sender ──────────────────────────────────────────────────────────────

interface RawEvent {
  eventType: string;
  name: string;
  url: string;
  anonymousId: string;
  userId?: string;
  referrer?: string;
  properties?: Record<string, unknown>;
}

async function sendEvent(payload: RawEvent): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // keepalive sends the request even when the page is unloading
      keepalive: true,
    });
  } catch {
    // analytics failures must never surface to the user
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface TrackArgs {
  name: string;
  eventType?: string;
  properties?: Record<string, unknown>;
}

interface AnalyticsContextValue {
  consentLevel: ConsentLevel;
  /** Track any named event. Properties are auto-masked for sensitive keys. */
  track: (args: TrackArgs) => void;
  /** Associate the current anonymous session with a known user. */
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  /** Convenience wrapper for conversion events (booking, payment, subscription). */
  trackConversion: (type: string, properties?: Record<string, unknown>) => void;
  /** Manually track a page view (called automatically on route change). */
  trackPageView: (url?: string) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
  consentLevel: 'none',
  track: () => {},
  identify: () => {},
  trackConversion: () => {},
  trackPageView: () => {},
});

export function useAnalyticsContext(): AnalyticsContextValue {
  return useContext(AnalyticsContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [consentLevel, setConsentLevel] = useState<ConsentLevel>('none');
  const prevPathRef = useRef<string | null>(null);

  // Read persisted consent on mount
  useEffect(() => {
    const stored = (localStorage.getItem(CONSENT_KEY) as ConsentLevel | null) ?? 'none';
    setConsentLevel(stored);
  }, []);

  // React to ConsentBanner decisions without a page reload
  useEffect(() => {
    const handler = (e: Event) => {
      const level = (e as CustomEvent<{ level: ConsentLevel }>).detail.level;
      setConsentLevel(level);
    };
    window.addEventListener(CONSENT_EVENT, handler);
    return () => window.removeEventListener(CONSENT_EVENT, handler);
  }, []);

  // Auto page-view on route change
  useEffect(() => {
    if (!meetsLevel(consentLevel, 'analytics')) return;
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;
    sendEvent({
      eventType: 'page_view',
      name: 'page_view',
      url: window.location.href,
      referrer: document.referrer,
      anonymousId: anonymousId(),
    });
  }, [pathname, consentLevel]);

  const track = useCallback(
    ({ name, eventType = 'custom', properties = {} }: TrackArgs) => {
      if (!meetsLevel(consentLevel, 'analytics')) return;
      sendEvent({
        eventType,
        name,
        url: window.location.href,
        properties: maskProperties(properties),
        anonymousId: anonymousId(),
      });
    },
    [consentLevel],
  );

  const identify = useCallback(
    (userId: string, traits: Record<string, unknown> = {}) => {
      if (!meetsLevel(consentLevel, 'analytics')) return;
      sendEvent({
        eventType: 'identify',
        name: 'identify',
        url: window.location.href,
        // userId sent server-side only — not logged client-side
        userId,
        properties: maskProperties(traits),
        anonymousId: anonymousId(),
      });
    },
    [consentLevel],
  );

  const trackConversion = useCallback(
    (type: string, properties: Record<string, unknown> = {}) => {
      if (!meetsLevel(consentLevel, 'analytics')) return;
      sendEvent({
        eventType: type,
        name: type,
        url: window.location.href,
        properties: maskProperties(properties),
        anonymousId: anonymousId(),
      });
    },
    [consentLevel],
  );

  const trackPageView = useCallback(
    (url?: string) => {
      if (!meetsLevel(consentLevel, 'analytics')) return;
      sendEvent({
        eventType: 'page_view',
        name: 'page_view',
        url: url ?? window.location.href,
        referrer: document.referrer,
        anonymousId: anonymousId(),
      });
    },
    [consentLevel],
  );

  return (
    <AnalyticsContext.Provider
      value={{ consentLevel, track, identify, trackConversion, trackPageView }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}
