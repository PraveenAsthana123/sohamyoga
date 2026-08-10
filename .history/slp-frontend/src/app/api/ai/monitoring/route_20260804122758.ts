import { NextRequest } from 'next/server';
import { getMonitoringSnapshot } from '@/lib/monitoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const snapshot = await getMonitoringSnapshot();
  return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}
