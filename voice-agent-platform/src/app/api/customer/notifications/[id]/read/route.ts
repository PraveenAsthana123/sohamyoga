import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/requireCustomer';
import { markNotificationReadForCustomer } from '@/domain/notification/repository';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCustomer(req);
  if (auth.denied) return auth.denied;

  const notification = await markNotificationReadForCustomer(params.id, auth.principal.id);
  if (!notification) return NextResponse.json({ error: 'Notification not found or already read.' }, { status: 404 });
  return NextResponse.json(notification.toJSON());
}
