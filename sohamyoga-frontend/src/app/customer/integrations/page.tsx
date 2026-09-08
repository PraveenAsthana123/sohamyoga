'use client';
// /customer/integrations — honest, real integration status. No fabricated
// "connected" badges: what genuinely works today is marked available, what
// isn't built yet says so plainly.

import { useEffect, useState } from 'react';

interface Integration { key: string; label: string; status: string; description: string; actionUrl?: string; actionLabel?: string }

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-green-100 text-green-700' },
  not_available: { label: 'Not yet available', className: 'bg-gray-100 text-gray-500' },
  preference_on_no_provider: { label: 'Opted in — not yet sending', className: 'bg-amber-100 text-amber-700' },
  preference_off: { label: 'Opted out', className: 'bg-gray-100 text-gray-500' },
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    fetch('/api/customer/integrations', { cache: 'no-store' }).then(r => r.json()).then(d => setIntegrations(d.integrations ?? []));
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="mt-1 text-sm text-gray-500">What's genuinely connected today, and what's honestly not built yet.</p>
      </div>
      <div className="space-y-2">
        {integrations.map(i => {
          const badge = STATUS_BADGE[i.status] ?? { label: i.status, className: 'bg-gray-100 text-gray-500' };
          return (
            <div key={i.key} className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{i.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{i.description}</p>
              {i.actionUrl && <a href={i.actionUrl} className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">{i.actionLabel} →</a>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
