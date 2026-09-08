import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Master Use Case Registry -- finer-grained than module_registry. Tracks
// every individual use case pulled from two ChatGPT platform-blueprint
// conversations (52 Control Towers + 12 transactional-backbone domains +
// digital-marketing module list), honestly statused against real code.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const category = req.nextUrl.searchParams.get('category');
  const status = req.nextUrl.searchParams.get('status');

  const conditions = ['tenant_id = $1'];
  const values: unknown[] = [tenantId];
  if (category) { values.push(category); conditions.push(`category = $${values.length}`); }
  if (status) { values.push(status); conditions.push(`status = $${values.length}`); }

  const rows = await query(
    `SELECT id, source, category, domain, use_case_key, title, description, status, evidence,
            module_registry_key, priority, ai_priority, ai_buildability, ai_recommendation,
            ai_assessed_at, created_at, updated_at
     FROM use_case_registry WHERE ${conditions.join(' AND ')}
     ORDER BY category, domain, CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, title`,
    values,
  );

  const summary = await query<{ category: string; status: string; count: string }>(
    `SELECT category, status, COUNT(*) AS count FROM use_case_registry WHERE tenant_id = $1 GROUP BY category, status`,
    [tenantId],
  );

  return Response.json({ useCases: rows.rows, summary: summary.rows, total: rows.rowCount });
}
