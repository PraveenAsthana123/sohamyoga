import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { getShareOfVoiceSummary } from '@/domain/pr/ShareOfVoice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real, admin-entered media mention logging -- no PR distribution or
// media-monitoring API exists or is invoked here.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  return Response.json(await getShareOfVoiceSummary(tenantId));
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { sourceName?: string; mentionType?: string; url?: string; sentiment?: string; excerpt?: string } | null;
  if (!body?.sourceName || !body.mentionType) return Response.json({ error: 'sourceName and mentionType are required.' }, { status: 400 });
  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO media_mention (tenant_id, source_name, mention_type, url, sentiment, excerpt, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [tenantId, body.sourceName, body.mentionType, body.url ?? null, body.sentiment ?? null, body.excerpt ?? '', principal?.email ?? 'admin'],
  );
  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
