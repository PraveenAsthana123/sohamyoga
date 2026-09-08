import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getCalendarProviderAdapter } from '@/domain/calendar/getCalendarProviderAdapter';

// GET /api/calendar/status -- honest configuration status, never fabricates
// "connected" when it isn't.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const adapter = getCalendarProviderAdapter();
  return NextResponse.json({ provider: adapter.providerKey, configured: adapter.isConfigured() });
}
