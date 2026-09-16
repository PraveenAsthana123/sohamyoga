'use client';
// /customer/inbox — real in-app notifications addressed to this customer
// (notification_queue). Currently populated by real booking confirmations/
// waitlist notices; not a general email inbox (no email provider is
// deployed in this environment).

import { useEffect, useState } from 'react';

interface Notification { id: string; template_slug: string; payload: Record<string, unknown>; status: string; sent_at: string | null; created_at: string }

const TEMPLATE_LABEL: Record<string, string> = {
  booking_confirmation: '✅ Booking confirmed',
  booking_waitlisted: '⏳ Added to waitlist',
};

export default function InboxPage() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    fetch('/api/customer/inbox', { cache: 'no-store' }).then(r => r.json()).then(d => setNotifications(d.notifications ?? []));
  }, []);

  return (
    <div className="max-w-2xl space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold text-white">Inbox</h1>
        <p className="mt-1 text-sm text-white/60">Real notifications about your bookings. This is not an email inbox — no email provider is connected yet (see Integrations).</p>
      </div>
      <div className="space-y-2 text-white">
        {notifications?.map(n => (
          <div key={n.id} className="rounded-lg border border-white/20 bg-slate-800/70 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{TEMPLATE_LABEL[n.template_slug] ?? n.template_slug}</span>
              <span className="text-xs text-white/50">{new Date(n.created_at).toLocaleString()}</span>
            </div>
            {typeof n.payload?.sessionDate === 'string' && (
              <p className="mt-1 text-xs text-white/60">Class on {new Date(n.payload.sessionDate as string).toLocaleDateString()}{typeof n.payload.startTime === 'string' ? ` at ${n.payload.startTime}` : ''}</p>
            )}
            {typeof n.payload?.position === 'number' && <p className="mt-1 text-xs text-white/60">Waitlist position: {n.payload.position as number}</p>}
          </div>
        ))}
        {notifications && !notifications.length && <p className="text-sm text-white/50">No notifications yet.</p>}
        {!notifications && <p className="text-sm text-white/50">Loading…</p>}
      </div>
    </div>
  );
}
