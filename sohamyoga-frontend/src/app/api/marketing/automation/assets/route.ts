// GET /api/marketing/automation/assets?requestId=... — the generated content
// for a campaign, so an admin can actually read what needs review. Previously
// requests reached status='review_required' with no UI surface to see the
// generated headline/body/subject at all.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const requestId = req.nextUrl.searchParams.get('requestId');
  if (!requestId || !UUID.test(requestId)) {
    return Response.json({ error: 'A valid requestId is required.' }, { status: 400 });
  }

  const rows = await query<{
    id: string; asset_type: string; status: string; text_content: string | null; metadata: Record<string, unknown>; segment_key: string | null;
    compliance_status: string; compliance_notes: string | null;
  }>(
    `SELECT id, asset_type, status, text_content, metadata, segment_key, compliance_status, compliance_notes
     FROM generated_marketing_asset WHERE request_id = $1 ORDER BY segment_key NULLS FIRST, asset_type`,
    [requestId],
  );

  return Response.json({
    assets: rows.rows.map(a => ({
      id: a.id, assetType: a.asset_type, status: a.status, textContent: a.text_content,
      metadata: a.metadata, segmentKey: a.segment_key ?? undefined,
      complianceStatus: a.compliance_status, complianceNotes: a.compliance_notes ?? undefined,
    })),
  });
}
