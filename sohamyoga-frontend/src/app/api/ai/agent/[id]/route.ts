import { NextRequest } from 'next/server';
import { requestStatus } from '@/lib/agent';

// GET /api/ai/agent/:id → status + outputs of a queued request from the gateway.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!/^\d+$/.test(id)) {
    return Response.json({ error: 'Invalid request id' }, { status: 400 });
  }
  try {
    const status = await requestStatus(id);
    return Response.json(status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'gateway error';
    return Response.json({ error: 'The agent gateway is unavailable.', details: msg }, { status: 503 });
  }
}
