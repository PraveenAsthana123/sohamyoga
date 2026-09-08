import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real health_profile CRUD -- src/domain/wellness/db-schema.sql defines the
// table but nothing ever queried it; /admin/wellness was 100% mock constants
// (found live 2026-09-01). List view intentionally omits medications/pain
// details/doctor_notes -- those require a legal-basis reason, see [id]/route.ts.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT hp.id, hp.customer_id, c.display_name, c.email, hp.fitness_level, hp.pregnancy_mode,
            hp.senior_mode, hp.kids_mode, hp.doctor_clearance,
            array_length(hp.conditions, 1) AS condition_count,
            array_length(hp.allergies, 1) AS allergy_count,
            array_length(hp.injuries, 1) AS injury_count,
            hp.created_at, hp.updated_at
     FROM health_profile hp
     LEFT JOIN customer c ON c.id::text = hp.customer_id
     WHERE hp.tenant_id = $1
     ORDER BY hp.updated_at DESC`,
    [tenantId],
  );
  return Response.json({ profiles: rows.rows });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json();
  if (!body.customerId) return Response.json({ error: 'customerId is required.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const result = await query(
    `INSERT INTO health_profile (tenant_id, customer_id, conditions, allergies, injuries, medications,
       pregnancy_mode, pregnancy_week, senior_mode, kids_mode, fitness_level, doctor_clearance, doctor_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (tenant_id, customer_id) DO UPDATE SET
       conditions = EXCLUDED.conditions, allergies = EXCLUDED.allergies, injuries = EXCLUDED.injuries,
       medications = EXCLUDED.medications, pregnancy_mode = EXCLUDED.pregnancy_mode,
       pregnancy_week = EXCLUDED.pregnancy_week, senior_mode = EXCLUDED.senior_mode,
       kids_mode = EXCLUDED.kids_mode, fitness_level = EXCLUDED.fitness_level,
       doctor_clearance = EXCLUDED.doctor_clearance, doctor_notes = EXCLUDED.doctor_notes, updated_at = now()
     RETURNING id`,
    [tenantId, body.customerId, body.conditions ?? [], body.allergies ?? [], body.injuries ?? [],
     body.medications ?? [], body.pregnancyMode ?? false, body.pregnancyWeek ?? null,
     body.seniorMode ?? false, body.kidsMode ?? false, body.fitnessLevel ?? 'moderate',
     body.doctorClearance ?? false, body.doctorNotes ?? null],
  );

  const { logWellnessAudit } = await import('@/lib/wellness-audit');
  await logWellnessAudit({
    tenantId, action: 'health_profile_created_or_updated', actor: principal!.email ?? principal!.id,
    customerId: body.customerId, profileId: result.rows[0].id, legalBasis: 'staff_intake_form',
  });

  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
