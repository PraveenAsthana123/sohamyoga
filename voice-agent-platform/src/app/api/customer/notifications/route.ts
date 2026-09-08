import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/requireCustomer';
import { listNotifications, countUnreadNotifications } from '@/domain/notification/repository';

export async function GET(req: NextRequest) {
  const auth = await requireCustomer(req);
  if (auth.denied) return auth.denied;

  const [notifications, unreadCount] = await Promise.all([
    listNotifications('business_customer', auth.principal.id),
    countUnreadNotifications('business_customer', auth.principal.id),
  ]);
  return NextResponse.json({ notifications: notifications.map((n) => n.toJSON()), unreadCount });
}
