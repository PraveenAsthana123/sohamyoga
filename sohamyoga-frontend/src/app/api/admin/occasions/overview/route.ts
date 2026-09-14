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

  const [kpis, byOccasion, recent, festivals] = await Promise.all([
    query<{ total: string; sent: string; pending: string; failed: string; with_dob: string; with_country: string }>(
      `SELECT
         (SELECT count(*) FROM wish_card WHERE tenant_id = $1)::text AS total,
         (SELECT count(*) FROM wish_card WHERE tenant_id = $1 AND status = 'SENT')::text AS sent,
         (SELECT count(*) FROM wish_card WHERE tenant_id = $1 AND status = 'PENDING')::text AS pending,
         (SELECT count(*) FROM wish_card WHERE tenant_id = $1 AND status = 'FAILED')::text AS failed,
         (SELECT count(*) FROM student WHERE tenant_id = $1 AND date_of_birth IS NOT NULL)::text AS with_dob,
         (SELECT count(*) FROM student WHERE tenant_id = $1 AND country IS NOT NULL)::text AS with_country
      `,
      [tenantId],
    ),
    query<{ occasion: string; n: string }>(
      `SELECT occasion, count(*)::text AS n FROM wish_card WHERE tenant_id = $1 GROUP BY occasion`,
      [tenantId],
    ),
    query<{ id: string; occasion: string; festival_code: string | null; title: string; channel: string; status: string; created_at: string; display_name: string }>(
      `SELECT wc.id, wc.occasion, wc.festival_code, wc.title, wc.channel, wc.status, wc.created_at, s.display_name
       FROM wish_card wc JOIN student s ON s.id = wc.student_id
       WHERE wc.tenant_id = $1 ORDER BY wc.created_at DESC LIMIT 50`,
      [tenantId],
    ),
    query<{ id: string; code: string; name: string; occasion_date: string; country: string | null; is_active: boolean }>(
      `SELECT id, code, name, occasion_date, country, is_active FROM festival_calendar WHERE tenant_id = $1 ORDER BY occasion_date`,
      [tenantId],
    ),
  ]);

  return Response.json({
    kpis: kpis.rows[0],
    byOccasion: Object.fromEntries(byOccasion.rows.map((r) => [r.occasion, Number(r.n)])),
    recent: recent.rows,
    festivals: festivals.rows,
  });
}
