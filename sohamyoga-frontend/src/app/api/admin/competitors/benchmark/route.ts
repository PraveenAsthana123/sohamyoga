import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { getBenchmarkSummary, BENCHMARK_DIMENSIONS } from '@/domain/competitor/BenchmarkEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const summaries = await getBenchmarkSummary(tenantId);
  return Response.json({ dimensions: BENCHMARK_DIMENSIONS, competitors: summaries });
}

// Real, admin-entered observation only -- no external API/scraper exists
// or is invoked here (same disclosed limitation as the price-tracking
// domain this extends).
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { competitorId?: string; dimension?: string; score?: number; observedAt?: string; notes?: string } | null;
  if (!body?.competitorId || !body.dimension || body.score === undefined || !body.observedAt) {
    return Response.json({ error: 'competitorId, dimension, score, and observedAt are required.' }, { status: 400 });
  }
  if (!(BENCHMARK_DIMENSIONS as readonly string[]).includes(body.dimension)) {
    return Response.json({ error: `dimension must be one of: ${BENCHMARK_DIMENSIONS.join(', ')}` }, { status: 400 });
  }
  if (body.score < 0 || body.score > 100) return Response.json({ error: 'score must be 0-100' }, { status: 400 });

  const result = await query<{ id: string }>(
    `INSERT INTO competitor_benchmark_score (competitor_id, dimension, score, observed_at, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (competitor_id, dimension, observed_at) DO UPDATE SET score=$3, notes=$5
     RETURNING id`,
    [body.competitorId, body.dimension, body.score, body.observedAt, body.notes ?? '', principal?.email ?? 'admin'],
  );
  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
