import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const tenantId = await getPrimaryTenantId();
  const rows = await query(`SELECT * FROM security_scan_run WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  if (!rows.rowCount) return Response.json({ error: 'Scan run not found.' }, { status: 404 });
  return Response.json({ scan: rows.rows[0] });
}
