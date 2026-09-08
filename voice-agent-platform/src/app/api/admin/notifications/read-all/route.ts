import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { markAllNotificationsRead } from '@/domain/notification/repository';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const count = await markAllNotificationsRead('admin', null);
  return NextResponse.json({ markedRead: count });
}
