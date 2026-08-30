import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getCall } from '@/domain/call/repository';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const call = await getCall(params.id);
  if (!call) return NextResponse.json({ error: 'Call not found.' }, { status: 404 });
  return NextResponse.json(call.toJSON());
}
