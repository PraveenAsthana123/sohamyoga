'use client';

// Mandatory UI-layer tracking: every uncaught error / unhandled promise
// rejection on any page gets reported to /api/ui-errors so it shows up in
// Operations & Failure Tracking instead of silently living only in the
// affected user's DevTools console.
import { useEffect } from 'react';

export default function UiErrorReporter() {
  useEffect(() => {
    const report = (message: string, stack?: string) => {
      void fetch('/api/ui-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagePath: window.location.pathname, message, stack }),
      }).catch(() => {});
    };
    const onError = (e: ErrorEvent) => report(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      report(reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : undefined);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
