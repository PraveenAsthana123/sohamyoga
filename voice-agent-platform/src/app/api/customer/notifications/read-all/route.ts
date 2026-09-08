import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/requireCustomer';
import { markAllNotificationsRead } from '@/domain/notification/repository';

export async function POST(req: NextRequest) {
  const auth = await requireCustomer(req);
  if (auth.denied) return auth.denied;

  const count = await markAllNotificationsRead('business_customer', auth.principal.id);
  return NextResponse.json({ markedRead: count });
}
