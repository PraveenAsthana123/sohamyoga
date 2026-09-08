import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { listNotifications, countUnreadNotifications } from '@/domain/notification/repository';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const [notifications, unreadCount] = await Promise.all([
    listNotifications('admin', null),
    countUnreadNotifications('admin', null),
  ]);
  return NextResponse.json({ notifications: notifications.map((n) => n.toJSON()), unreadCount });
}
