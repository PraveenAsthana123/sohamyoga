'use client';
import { useState, useEffect } from 'react';

export type ConsentLevel = 'none' | 'essential' | 'analytics' | 'marketing' | 'all';

export const CONSENT_KEY = 'sohamyoga_consent';
export const CONSENT_EVENT = 'slp:consent';

export function getStoredConsent(): ConsentLevel | null {
  if (typeof window === 'undefined') return null;
  return (localStorage.getItem(CONSENT_KEY) as ConsentLevel) ?? null;
}

export function setStoredConsent(level: ConsentLevel) {
  localStorage.setItem(CONSENT_KEY, level);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { level } }));
  persistConsent(level);
}

// Records the choice server-side (analytics_consent_record) so consent can
// actually be demonstrated later — localStorage alone is not an audit trail.
// Best-effort: a failed write must never block the banner from closing.
function persistConsent(level: ConsentLevel) {
  const anonymousId = localStorage.getItem('sohamyoga_anon_id')
    ?? `anon-${Math.random().toString(36).slice(2, 10)}-${performance.now().toString(36).replace('.', '')}`;
  localStorage.setItem('sohamyoga_anon_id', anonymousId);
  fetch('/api/analytics/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anonymousId, level }),
    keepalive: true,
  }).catch(() => { /* consent choice still applies locally even if the write fails */ });
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [detailed, setDetailed] = useState(false);

  useEffect(() => {
    if (!getStoredConsent()) setVisible(true);
  }, []);

  const choose = (level: ConsentLevel) => {
    setStoredConsent(level);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie and analytics consent"
      // z-[1100]: the floating ChatWidget is position:fixed with z-index:1000
      // (globals.css .chat-widget) and sits bottom-right — the same corner
      // this banner's rightmost button ("Accept All") occupies. At z-50 the
      // chat button's icon rendered on top and silently ate the click,
      // confirmed live (Playwright: "element intercepts pointer events").
      // A compliance-critical consent control must never be unclickable.
      className="fixed bottom-0 left-0 right-0 z-[1100] bg-white border-t border-gray-100 shadow-2xl"
    >
      <div className="max-w-7xl mx-auto p-4">
        {!detailed ? (
          /* ── Compact banner ── */
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 leading-relaxed">
                <span className="font-semibold text-gray-900">Your privacy matters.</span>{' '}
                We use essential cookies to run the portal and optional analytics to understand how visitors navigate — no
                passwords, health information, or payment data are ever recorded.{' '}
                <button
                  onClick={() => setDetailed(true)}
                  className="text-amber-800 hover:text-amber-900 underline text-sm"
                >
                  Customize
                </button>
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button
                onClick={() => choose('essential')}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Essential Only
              </button>
              <button
                onClick={() => choose('analytics')}
                className="px-4 py-2 text-sm font-semibold text-gray-950 bg-amber-400 hover:bg-amber-500 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-amber-700"
              >
                Accept Analytics
              </button>
              <button
                onClick={() => choose('all')}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-gray-500"
              >
                Accept All
              </button>
            </div>
          </div>
        ) : (
          /* ── Detailed picker ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Manage Cookie Preferences</h3>
              <button
                onClick={() => setDetailed(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
                aria-label="Back to simple banner"
              >
                ← Back
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  {
                    level: 'essential' as ConsentLevel,
                    title: 'Essential Only',
                    description: 'Login sessions, security, and shopping cart — always active.',
                    border: 'border-gray-300',
                  },
                  {
                    level: 'analytics' as ConsentLevel,
                    title: 'Analytics',
                    description:
                      'Page views, funnels, session duration, and error tracking — no personal data.',
                    border: 'border-amber-400',
                  },
                  {
                    level: 'all' as ConsentLevel,
                    title: 'All Including Marketing',
                    description:
                      'Analytics plus personalisation, A/B testing, and re-marketing cookies.',
                    border: 'border-gray-800',
                  },
                ] as const
              ).map(opt => (
                <button
                  key={opt.level}
                  onClick={() => choose(opt.level)}
                  className={`text-left p-4 border-2 rounded-xl hover:border-amber-400 hover:shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-amber-400 ${opt.border}`}
                >
                  <p className="font-semibold text-gray-900 text-sm">{opt.title}</p>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">{opt.description}</p>
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-400">
              We never record passwords, health information, payment details, or private messages during session replays. See our{' '}
              <a href="/privacy" className="text-amber-600 hover:underline">
                Privacy Policy
              </a>{' '}
              (GDPR · PIPEDA · DPDP Act 2023).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
