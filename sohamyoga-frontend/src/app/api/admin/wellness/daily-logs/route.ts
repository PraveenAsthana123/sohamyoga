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
        `SELECT dwl.*, c.display_name, c.email FROM daily_wellness_log dwl
         LEFT JOIN customer c ON c.id::text = dwl.customer_id
         WHERE dwl.tenant_id = $1 AND dwl.customer_id = $2 ORDER BY dwl.date DESC LIMIT 100`,
        [tenantId, customerId],
      )
    : await query(
        `SELECT dwl.*, c.display_name, c.email FROM daily_wellness_log dwl
         LEFT JOIN customer c ON c.id::text = dwl.customer_id
         WHERE dwl.tenant_id = $1 ORDER BY dwl.date DESC LIMIT 100`,
        [tenantId],
      );
  return Response.json({ entries: rows.rows });
}

export async function POST(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json();
  if (!body.customerId || !body.date) {
    return Response.json({ error: 'customerId and date are required.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const result = await query(
    `INSERT INTO daily_wellness_log (tenant_id, customer_id, date, sleep_hours, water_ml, calorie_burn, steps, heart_rate_bpm, mood, energy_level, stress_level, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (tenant_id, customer_id, date) DO UPDATE SET
       sleep_hours = EXCLUDED.sleep_hours, water_ml = EXCLUDED.water_ml, calorie_burn = EXCLUDED.calorie_burn,
       steps = EXCLUDED.steps, heart_rate_bpm = EXCLUDED.heart_rate_bpm, mood = EXCLUDED.mood,
       energy_level = EXCLUDED.energy_level, stress_level = EXCLUDED.stress_level, notes = EXCLUDED.notes, updated_at = now()
     RETURNING id`,
    [tenantId, body.customerId, body.date, body.sleepHours ?? null, body.waterMl ?? null,
     body.calorieBurn ?? null, body.steps ?? null, body.heartRateBpm ?? null, body.mood ?? null,
     body.energyLevel ?? null, body.stressLevel ?? null, body.notes ?? null],
  );
  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
