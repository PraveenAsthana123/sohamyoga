import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { Competitor } from '@/domain/competitor/Competitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — list competitors for this tenant, with each competitor's latest
// price point per service folded in for a quick-glance comparison. Real
// admin-entered data only — no external scraper, no fabricated pricing.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const competitors = await query(
    `SELECT id, name, website, notes, created_at FROM competitor WHERE tenant_id = $1 ORDER BY name ASC`,
    [tenantId],
  );
  const pricePoints = await query(
    `SELECT id, competitor_id, service_name, price, currency, effective_date, notes, created_at
     FROM competitor_price_point WHERE competitor_id = ANY($1::uuid[]) ORDER BY effective_date DESC`,
    [competitors.rows.map(c => (c as { id: string }).id)],
  );

  // "Our pricing" side of the comparison — reuses the real, already-seeded
  // pricing_plan_master/pricing_plan_price tables (src/domain/pricing), not
  // invented/parallel pricing data.
  const ourPricing = await query(
    `SELECT m.name AS service_name, pp.amount AS price, pp.currency, pp.billing_cycle
     FROM pricing_plan_master m
     JOIN pricing_plan_price pp ON pp.plan_id = m.id
     WHERE m.status = 'active' AND pp.is_promotional = false
     ORDER BY m.sort_order, m.name, pp.billing_cycle`,
  );

  return Response.json({
    competitors: competitors.rows.map(c => ({
      ...c,
      pricePoints: pricePoints.rows.filter(p => (p as { competitor_id: string }).competitor_id === (c as { id: string }).id),
    })),
    ourPricing: ourPricing.rows,
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { name?: string; website?: string; notes?: string } | null;
  if (!body?.name) return Response.json({ error: 'name is required.' }, { status: 400 });

  try {
    new Competitor({
      id: '00000000-0000-0000-0000-000000000000', name: body.name, website: body.website,
      notes: body.notes ?? '', createdBy: principal!.id, createdAt: new Date(), updatedAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid competitor data.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO competitor (tenant_id, name, website, notes, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [tenantId, body.name, body.website ?? null, body.notes ?? '', principal!.id],
    );
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A competitor with this name already exists.' : message }, { status });
  }
}
