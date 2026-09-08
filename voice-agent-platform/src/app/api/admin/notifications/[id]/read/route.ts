import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { markNotificationRead } from '@/domain/notification/repository';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const notification = await markNotificationRead(params.id);
  if (!notification) return NextResponse.json({ error: 'Notification not found or already read.' }, { status: 404 });
  return NextResponse.json(notification.toJSON());
}
