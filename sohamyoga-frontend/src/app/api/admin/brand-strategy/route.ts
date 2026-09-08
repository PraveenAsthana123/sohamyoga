import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { getBrandStrategy, upsertBrandStrategy, getBrandArchitecture } from '@/domain/branding/BrandStrategy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const [strategy, architecture] = await Promise.all([getBrandStrategy(tenantId), getBrandArchitecture(tenantId)]);
  return Response.json({ strategy, architecture });
}

interface StrategyBody { mission?: string; vision?: string; targetAudience?: string; keyDifferentiators?: string[] }

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as StrategyBody | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  await upsertBrandStrategy(
    tenantId,
    { mission: body.mission ?? '', vision: body.vision ?? '', targetAudience: body.targetAudience ?? '', keyDifferentiators: body.keyDifferentiators ?? [] },
    'admin'
  );
  const strategy = await getBrandStrategy(tenantId);
  return Response.json({ strategy });
}
