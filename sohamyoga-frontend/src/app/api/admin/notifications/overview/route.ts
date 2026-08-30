import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — replaces the previous fully-hardcoded DEMO_* data in
// admin/notifications/page.tsx with real queries against the real
// notification_template/queue/history/analytics/preference schema.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();

  const [templates, queue, channelHealth, topTemplates, retryQueue, prefCounts] = await Promise.all([
    query<{ id: string; status: string }>(
      `SELECT id, slug, name, channel, type, status::text, version, approved_at
       FROM notification_template WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT 50`,
      [tenantId],
    ),
    query(
      `SELECT id, template_slug, channel, recipient_address, status::text, scheduled_at, retry_count, created_at
       FROM notification_queue WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [tenantId],
    ),
    query(
      `SELECT channel, sent_7d, delivered_7d, failed_7d, bounced_7d, delivery_rate_pct, open_rate_pct, click_rate_pct
       FROM v_channel_health WHERE tenant_id = $1`,
      [tenantId],
    ),
    query(
      `SELECT template_slug, channel, sent_30d, delivered_30d, delivery_pct, open_pct
       FROM v_top_templates WHERE tenant_id = $1 LIMIT 10`,
      [tenantId],
    ),
    query(`SELECT count(*)::int AS n FROM notification_queue WHERE tenant_id = $1 AND status = 'failed' AND retry_count < 3`, [tenantId]),
    query(
      `SELECT count(*) FILTER (WHERE status='pending' OR status='scheduled')::int AS pending,
              count(*) FILTER (WHERE status='sent')::int AS sent_today
       FROM notification_queue WHERE tenant_id = $1 AND created_at >= CURRENT_DATE`,
      [tenantId],
    ),
  ]);

  return Response.json({
    templates: templates.rows,
    queue: queue.rows,
    channelHealth: channelHealth.rows,
    topTemplates: topTemplates.rows,
    retryEligibleCount: retryQueue.rows[0]?.n ?? 0,
    todayPendingCount: prefCounts.rows[0]?.pending ?? 0,
    todaySentCount: prefCounts.rows[0]?.sent_today ?? 0,
    templateActiveCount: templates.rows.filter((t: { status: string }) => t.status === 'active').length,
  });
}
