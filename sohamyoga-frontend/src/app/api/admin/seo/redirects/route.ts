import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { listRedirectRules, createRedirectRule } from '@/domain/seo/redirectRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rules = await listRedirectRules(tenantId);
  return Response.json({ rules });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const fromPath = typeof body?.fromPath === 'string' ? body.fromPath : '';
  const toPath = typeof body?.toPath === 'string' ? body.toPath : '';
  const statusCode = [301, 302, 307, 308].includes(body?.statusCode) ? body.statusCode : 301;
  if (!fromPath.startsWith('/') || !toPath.startsWith('/')) {
    return Response.json({ error: 'fromPath and toPath must both start with /.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const rule = await createRedirectRule(tenantId, fromPath, toPath, statusCode);
  return Response.json(rule, { status: 201 });
}
