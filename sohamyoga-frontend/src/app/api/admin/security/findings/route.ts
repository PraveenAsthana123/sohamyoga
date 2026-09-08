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
  const severity = req.nextUrl.searchParams.get('severity');
  const category = req.nextUrl.searchParams.get('category');
  const status = req.nextUrl.searchParams.get('status') ?? 'open';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 200, 1000);

  const conditions = ['f.tenant_id = $1'];
  const values: unknown[] = [tenantId];
  if (severity) { values.push(severity); conditions.push(`f.severity = $${values.length}`); }
  if (category) { values.push(category); conditions.push(`r.category = $${values.length}`); }
  if (status !== 'all') { values.push(status); conditions.push(`f.status = $${values.length}`); }
  values.push(limit);

  const rows = await query(
    `SELECT f.id, f.severity, f.title, f.description, f.file_path, f.line_number, f.package_name,
            f.installed_version, f.fixed_version, f.cve_id, f.rule_id, f.status,
            f.first_seen_at, f.last_seen_at, f.resolved_at, f.resolved_by,
            r.category, r.tool, r.target
     FROM security_finding f
     JOIN security_scan_run r ON r.id = f.scan_run_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
              f.last_seen_at DESC
     LIMIT $${values.length}`,
    values,
  );

  const summary = await query<{ severity: string; count: string }>(
    `SELECT f.severity, COUNT(*) AS count FROM security_finding f
     JOIN security_scan_run r ON r.id = f.scan_run_id
     WHERE f.tenant_id = $1 AND f.status = 'open' GROUP BY f.severity`,
    [tenantId],
  );

  return Response.json({ findings: rows.rows, openSummary: summary.rows });
}
