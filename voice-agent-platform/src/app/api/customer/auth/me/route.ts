import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/requireCustomer';

export async function GET(req: NextRequest) {
  const auth = await requireCustomer(req);
  if (auth.denied) return auth.denied;
  return NextResponse.json(auth.principal);
}
