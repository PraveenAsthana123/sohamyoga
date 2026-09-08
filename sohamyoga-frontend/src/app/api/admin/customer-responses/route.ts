import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req); if (denied) return denied;
  if (!principal?.roles.includes('Admin')) return Response.json({ error: 'Administrator access is required.' }, { status: 403 });
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const status = req.nextUrl.searchParams.get('status');
  const platform = req.nextUrl.searchParams.get('platform');
  const threads = await query(`SELECT t.*,
    COALESCE(json_agg(json_build_object('id',e.id,'direction',e.direction,'type',e.event_type,'text',e.text_excerpt,
      'sentiment',e.sentiment,'intent',e.intent,'occurredAt',e.occurred_at,'metadata',e.metadata)
      ORDER BY e.occurred_at DESC) FILTER (WHERE e.id IS NOT NULL),'[]') AS recent_events,
    count(e.id)::int AS event_count
    FROM customer_channel_thread t LEFT JOIN LATERAL
      (SELECT * FROM customer_channel_event WHERE thread_id=t.id ORDER BY occurred_at DESC LIMIT 20) e ON true
    WHERE t.tenant_id=$1 AND ($2::text IS NULL OR t.status=$2) AND ($3::text IS NULL OR t.platform_key=$3)
    GROUP BY t.id ORDER BY COALESCE(t.last_inbound_at,t.last_outbound_at,t.updated_at) DESC LIMIT 250`,
    [tenantId, status || null, platform || null]);
  const summary = await query(`SELECT count(*)::int AS total,
    count(*) FILTER (WHERE status='open')::int AS open,
    count(*) FILTER (WHERE status='waiting_agent')::int AS waiting_agent,
    count(*) FILTER (WHERE status='waiting_customer')::int AS waiting_customer,
    count(*) FILTER (WHERE status='resolved')::int AS resolved
    FROM customer_channel_thread WHERE tenant_id=$1`, [tenantId]);
  return Response.json({ threads: threads.rows, summary: summary.rows[0] });
}
