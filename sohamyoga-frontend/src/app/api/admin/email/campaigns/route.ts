import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    // per-campaign drill-down with send log stats
    const [campaign, stats] = await Promise.all([
      query(`SELECT * FROM email_campaign WHERE id=$1`, [id]),
      query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked')) AS delivered,
          COUNT(*) FILTER (WHERE status = 'opened')      AS opens,
          COUNT(*) FILTER (WHERE status = 'clicked')     AS clicks,
          COUNT(*) FILTER (WHERE status = 'bounced')     AS bounces,
          COUNT(*) FILTER (WHERE status = 'unsubscribed') AS unsubscribes,
          COUNT(*) FILTER (WHERE status = 'spam')        AS spam
        FROM email_send_log WHERE campaign_id=$1
      `, [id]),
    ]);
    if (!campaign.rowCount) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ campaign: campaign.rows[0], stats: stats.rows[0] });
  }

  const result = await query(`
    SELECT ec.*,
           COUNT(sl.id)                                                  AS total_sent,
           COUNT(sl.id) FILTER (WHERE sl.status = 'opened')             AS opens,
           COUNT(sl.id) FILTER (WHERE sl.status = 'clicked')            AS clicks,
           COUNT(sl.id) FILTER (WHERE sl.status = 'bounced')            AS bounces,
           COUNT(sl.id) FILTER (WHERE sl.status = 'unsubscribed')       AS unsubscribes
    FROM email_campaign ec
    LEFT JOIN email_send_log sl ON sl.campaign_id = ec.id
    GROUP BY ec.id
    ORDER BY ec.created_at DESC
  `);

  return Response.json({ campaigns: result.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, any> | null;
  if (!body?.name || !body?.subject) {
    return Response.json({ error: 'name and subject are required' }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO email_campaign (name, subject, template_id, status, scheduled_at, audience_filter)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      body.name,
      body.subject,
      body.template_id ?? null,
      body.status ?? 'draft',
      body.scheduled_at ?? null,
      JSON.stringify(body.audience_filter ?? {}),
    ],
  );
  return Response.json({ campaign: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, any> | null;
  if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });

  const result = await query(
    `UPDATE email_campaign SET name=$2, subject=$3, template_id=$4, status=$5, scheduled_at=$6 WHERE id=$1 RETURNING *`,
    [body.id, body.name, body.subject, body.template_id ?? null, body.status ?? 'draft', body.scheduled_at ?? null],
  );
  if (!result.rowCount) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ campaign: result.rows[0] });
}
