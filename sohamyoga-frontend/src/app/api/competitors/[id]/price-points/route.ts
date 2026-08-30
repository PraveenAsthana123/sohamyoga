import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { CompetitorPricePoint } from '@/domain/competitor/CompetitorPricePoint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST — record a real, admin-researched competitor price point over time.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    serviceName?: string; price?: number; currency?: string; effectiveDate?: string; notes?: string;
  } | null;
  if (!body?.serviceName || body.price === undefined || !body.effectiveDate) {
    return Response.json({ error: 'serviceName, price, and effectiveDate are required.' }, { status: 400 });
  }
  const currency = (body.currency ?? 'CAD').toUpperCase();

  try {
    new CompetitorPricePoint({
      id: '00000000-0000-0000-0000-000000000000', competitorId: params.id, serviceName: body.serviceName,
      price: body.price, currency, effectiveDate: new Date(body.effectiveDate), notes: body.notes ?? '',
      createdBy: principal!.id, createdAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid price point data.' }, { status: 400 });
  }

  const competitor = await query(`SELECT id FROM competitor WHERE id = $1`, [params.id]);
  if (!competitor.rows.length) return Response.json({ error: 'Competitor not found.' }, { status: 404 });

  const result = await query<{ id: string }>(
    `INSERT INTO competitor_price_point (competitor_id, service_name, price, currency, effective_date, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [params.id, body.serviceName, body.price, currency, body.effectiveDate, body.notes ?? '', principal!.id],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
