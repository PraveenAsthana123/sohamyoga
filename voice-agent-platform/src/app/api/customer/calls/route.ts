import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/requireCustomer';
import { listCallLogForCustomer } from '@/domain/customer/repository';

// GET /api/customer/calls -- real call history scoped to only this
// customer's own contacts. Honestly empty until real calls are logged
// against their contacts (today: manual admin logging; automatically once
// a Vapi webhook receiver exists -- not built yet).
export async function GET(req: NextRequest) {
  const auth = await requireCustomer(req);
  if (auth.denied) return auth.denied;
  const calls = await listCallLogForCustomer(auth.principal.id);
  return NextResponse.json({ calls });
}
