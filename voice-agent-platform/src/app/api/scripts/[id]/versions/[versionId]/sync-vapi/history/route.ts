import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { listVapiSyncLog } from '@/domain/script/repository';

// GET /api/scripts/:id/versions/:versionId/sync-vapi/history -- real
// trace log of every sync attempt (success or failure), most recent first.
export async function GET(req: NextRequest, { params }: { params: { id: string; versionId: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const entries = await listVapiSyncLog(params.versionId);
  return NextResponse.json(entries);
}
