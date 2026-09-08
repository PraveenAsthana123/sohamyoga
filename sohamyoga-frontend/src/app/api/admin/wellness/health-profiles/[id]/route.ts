import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { logWellnessAudit } from '@/lib/wellness-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Full health_profile detail (conditions, medications, pain areas, doctor
// notes) is sensitive PII -- WellnessMcpRegistry.ts marks get_health_profile
// as staff_approval tier requiring a legal basis. Mirrored here: a GET must
// carry ?legalBasis= or it's rejected, and every successful read is logged
// to wellness_audit (GDPR Art.9 / PIPEDA requirement per the schema comment).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const legalBasis = req.nextUrl.searchParams.get('legalBasis');
  if (!legalBasis?.trim()) {
    return Response.json({ error: 'legalBasis query parameter is required to access full health profile detail (HIPAA/PIPEDA audit requirement).' }, { status: 400 });
  }

  const { id } = await params;
  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT hp.*, c.display_name, c.email
     FROM health_profile hp
     LEFT JOIN customer c ON c.id::text = hp.customer_id
     WHERE hp.id = $1 AND hp.tenant_id = $2`,
    [id, tenantId],
  );
  if (!rows.rowCount) return Response.json({ error: 'Health profile not found.' }, { status: 404 });

  const profile = rows.rows[0] as { customer_id: string };
  await logWellnessAudit({
    tenantId, action: 'health_profile_accessed', actor: principal!.email ?? principal!.id,
    customerId: profile.customer_id, profileId: id, legalBasis,
  });

  return Response.json({ profile: rows.rows[0] });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  if (body.confirmText !== 'DELETE_HEALTH_PROFILE') {
    return Response.json({ error: 'confirmText must be "DELETE_HEALTH_PROFILE" -- matches the admin_destructive tier in WellnessMcpRegistry.' }, { status: 400 });
  }
  if (!body.legalBasis?.trim()) {
    return Response.json({ error: 'legalBasis is required -- deletion must record the GDPR right-to-erasure basis.' }, { status: 400 });
  }

  const { id } = await params;
  const tenantId = await getPrimaryTenantId();
  const existing = await query<{ customer_id: string }>(`SELECT customer_id FROM health_profile WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  if (!existing.rowCount) return Response.json({ error: 'Health profile not found.' }, { status: 404 });

  await logWellnessAudit({
    tenantId, action: 'health_profile_deleted', actor: principal!.email ?? principal!.id,
    customerId: existing.rows[0].customer_id, profileId: id, legalBasis: body.legalBasis,
  });
  await query(`DELETE FROM health_profile WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);

  return Response.json({ deleted: true });
}
