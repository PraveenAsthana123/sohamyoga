import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const customerId = req.nextUrl.searchParams.get('customerId');
  const rows = customerId
    ? await query(
        `SELECT bm.*, c.display_name, c.email FROM body_metrics bm
         LEFT JOIN customer c ON c.id::text = bm.customer_id
         WHERE bm.tenant_id = $1 AND bm.customer_id = $2 ORDER BY bm.recorded_at DESC LIMIT 100`,
        [tenantId, customerId],
      )
    : await query(
        `SELECT bm.*, c.display_name, c.email FROM body_metrics bm
         LEFT JOIN customer c ON c.id::text = bm.customer_id
         WHERE bm.tenant_id = $1 ORDER BY bm.recorded_at DESC LIMIT 100`,
        [tenantId],
      );
  return Response.json({ entries: rows.rows });
}

export async function POST(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json();
  if (!body.customerId || !body.weightKg || !body.heightCm) {
    return Response.json({ error: 'customerId, weightKg, and heightCm are required.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const result = await query(
    `INSERT INTO body_metrics (tenant_id, customer_id, recorded_at, weight_kg, height_cm, chest_cm, waist_cm, hips_cm, thighs_cm, arms_cm, notes)
     VALUES ($1, $2, COALESCE($3, now()), $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, bmi`,
    [tenantId, body.customerId, body.recordedAt ?? null, body.weightKg, body.heightCm,
     body.chestCm ?? null, body.waistCm ?? null, body.hipsCm ?? null, body.thighsCm ?? null,
     body.armsCm ?? null, body.notes ?? null],
  );
  return Response.json({ id: result.rows[0].id, bmi: result.rows[0].bmi }, { status: 201 });
}
