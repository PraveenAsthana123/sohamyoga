'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function useTrack() {
  const pathname = usePathname();
  const lastPath = useRef('');

  // Auto-track page views on route change
  useEffect(() => {
    if (pathname !== lastPath.current) {
      lastPath.current = pathname;
      track('pageview', { page_path: pathname });
    }
  }, [pathname]);

  return { track };
}

export function track(event_type: string, payload: Record<string, unknown> = {}) {
  // Fire and forget — no await needed in components
  fetch('/api/customer/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type, page_path: window.location.pathname, ...payload }),
  }).catch(() => {});
}
