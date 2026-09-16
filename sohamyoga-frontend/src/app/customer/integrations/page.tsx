'use client';
// /customer/integrations — honest, real integration status. No fabricated
// "connected" badges: what genuinely works today is marked available, what
// isn't built yet says so plainly.

import { useEffect, useState } from 'react';

interface Integration { key: string; label: string; status: string; description: string; actionUrl?: string; actionLabel?: string }

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-green-500/20 text-green-300' },
  not_available: { label: 'Not yet available', className: 'bg-white/10 text-white/60' },
  preference_on_no_provider: { label: 'Opted in — not yet sending', className: 'bg-amber-500/20 text-amber-300' },
  preference_off: { label: 'Opted out', className: 'bg-white/10 text-white/60' },
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    fetch('/api/customer/integrations', { cache: 'no-store' }).then(r => r.json()).then(d => setIntegrations(d.integrations ?? []));
  }, []);

  return (
    <div className="max-w-2xl space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="mt-1 text-sm text-white/60">What's genuinely connected today, and what's honestly not built yet.</p>
      </div>
      <div className="space-y-2 text-white">
        {integrations.map(i => {
          const badge = STATUS_BADGE[i.status] ?? { label: i.status, className: 'bg-white/10 text-white/60' };
          return (
            <div key={i.key} className="rounded-lg border border-white/20 backdrop-blur-md bg-white/10 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{i.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
              </div>
              <p className="mt-1 text-xs text-white/60">{i.description}</p>
              {i.actionUrl && <a href={i.actionUrl} className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">{i.actionLabel} →</a>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
