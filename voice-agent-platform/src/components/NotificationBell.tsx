'use client';

import { useEffect, useState, useCallback } from 'react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

/** Real in-app notifications only -- no email/SMS/Slack, since no
 * credentials exist for any of those (see docs/chatgpt-extracts/
 * vapi-architecture-risk-review.md, Topic R). Shared shape between the
 * admin and customer nav bars; `basePath` picks which real API it hits. */
export default function NotificationBell({
  basePath, openDirection = 'down',
}: {
  basePath: '/api/admin/notifications' | '/api/customer/notifications';
  openDirection?: 'up' | 'down';
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    fetch(basePath).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return;
      setItems(d.notifications ?? []);
      setUnreadCount(d.unreadCount ?? 0);
    });
  }, [basePath]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  async function markRead(id: string) {
    await fetch(`${basePath}/${id}/read`, { method: 'POST' });
    load();
  }

  async function markAllRead() {
    await fetch(`${basePath}/read-all`, { method: 'POST' });
    load();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded px-2 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 w-full text-left">
        Notifications
        {unreadCount > 0 && (
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs w-5 h-5">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className={`absolute z-10 left-0 w-80 max-h-96 overflow-y-auto border border-black/10 dark:border-white/10 rounded-lg bg-white dark:bg-black shadow-lg p-2 space-y-1 ${openDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium opacity-70">Notifications</span>
            {unreadCount > 0 && <button onClick={markAllRead} className="text-xs underline">Mark all read</button>}
          </div>
          {items.length === 0 && <p className="text-xs opacity-50 px-1 py-2">No notifications yet.</p>}
          {items.map((n) => (
            <div key={n.id} className={`text-xs rounded p-2 ${n.readAt ? 'opacity-50' : 'bg-black/5 dark:bg-white/10'}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{n.title}</span>
                {!n.readAt && <button onClick={() => markRead(n.id)} className="underline shrink-0">mark read</button>}
              </div>
              <p className="mt-0.5">{n.body}</p>
              <p className="mt-0.5 opacity-50">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
