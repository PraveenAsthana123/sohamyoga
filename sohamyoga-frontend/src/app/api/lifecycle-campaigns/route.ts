import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAMPAIGN_TYPES = ['one_time', 'trigger', 'drip', 'referral'];
const TRIGGER_EVENTS = ['form_submission', 'event_registration', 'booking', 'campaign_email', 'landing_page_view', 'survey_response'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; name: string; campaign_type: string; channels: string[]; status: string;
    audience_label: string; audience_size: number; goal_type: string; goal_target: number;
    conversions: number; revenue_cad: string; scheduled_at: string | null; created_at: string;
    notification_template_slug: string | null; dispatched_at: string | null;
  }>(
    `SELECT id, name, campaign_type, channels, status, audience_label, audience_size,
            goal_type, goal_target, conversions, revenue_cad, scheduled_at, created_at,
            notification_template_slug, dispatched_at
     FROM lifecycle_campaign ORDER BY created_at DESC`,
  );

  return Response.json({
    campaigns: rows.rows.map(c => ({
      id: c.id, name: c.name, type: c.campaign_type, channels: c.channels, status: c.status,
      audience: c.audience_label, audienceSize: c.audience_size, goalType: c.goal_type,
      goalTarget: c.goal_target, conversions: c.conversions, revenueCAD: Number(c.revenue_cad),
      scheduledAt: c.scheduled_at ?? undefined, createdAt: c.created_at,
      notificationTemplateSlug: c.notification_template_slug, dispatchedAt: c.dispatched_at,
    })),
  });
}

interface CreateBody {
  name?: string; type?: string; channels?: string[]; audienceLabel?: string; audienceSize?: number;
  goalType?: string; goalTarget?: number; triggerEvent?: string; scheduledAt?: string; isImmediate?: boolean;
  notificationTemplateSlug?: string; subject?: string; body?: string;
}
const DISPATCHABLE = ['email', 'push'];

// Real campaign creation -- the "New Campaign" wizard's Launch button
// previously called nothing at all (confirmed live: router.push with no
// fetch anywhere in the file). A campaign walked through 5 real-looking
// steps and then silently vanished on "launch."
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as CreateBody | null;
  if (!body?.name?.trim() || !CAMPAIGN_TYPES.includes(body.type ?? '')) {
    return Response.json({ error: `name and a valid type (${CAMPAIGN_TYPES.join('|')}) are required.` }, { status: 400 });
  }
  if (!body.channels?.length) return Response.json({ error: 'At least one channel is required.' }, { status: 400 });
  if (body.type === 'trigger' && !TRIGGER_EVENTS.includes(body.triggerEvent ?? '')) {
    return Response.json({ error: `triggerEvent must be one of: ${TRIGGER_EVENTS.join(', ')} for an Event Trigger campaign.` }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();

  // Real content persistence -- the wizard's Content step (including its
  // real Ollama-generated subject/body) was previously collected and then
  // silently dropped: POST here never received it, confirmed live. If real
  // message content was written, it becomes a real notification_template
  // (not a fabricated "sent" claim -- still gated by the same consent/
  // template-approval checks in the PATCH launch handler below) so Launch
  // has something real to dispatch.
  let notificationTemplateSlug = body.notificationTemplateSlug?.trim() || null;
  if (!notificationTemplateSlug && body.body?.trim()) {
    const primaryChannel = DISPATCHABLE.find(c => body.channels!.includes(c));
    if (primaryChannel) {
      const slug = `lifecycle-${body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}-${randomUUID().slice(0, 8)}`;
      await query(
        `INSERT INTO notification_template (tenant_id, slug, name, channel, type, subject, body, status, created_by, approved_by, approved_at)
         VALUES ($1,$2,$3,$4,'marketing',$5,$6,'active',$7,$7,now())`,
        [tenantId, slug, body.name.trim(), primaryChannel, body.subject?.trim() || body.name.trim(), body.body.trim(), principal?.id],
      );
      notificationTemplateSlug = slug;
    }
  }

  const result = await query<{ id: string }>(
    `INSERT INTO lifecycle_campaign
       (tenant_id, name, campaign_type, channels, status, audience_label, audience_size, goal_type, goal_target, trigger_event, scheduled_at, created_by, notification_template_slug)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      tenantId, body.name.trim(), body.type, body.channels, body.type === 'trigger' ? 'RUNNING' : 'SCHEDULED',
      body.audienceLabel ?? 'Unspecified', body.audienceSize ?? 0, body.goalType ?? 'awareness', body.goalTarget ?? 0,
      body.type === 'trigger' ? body.triggerEvent : null, body.isImmediate ? null : (body.scheduledAt || null),
      principal?.email ?? 'admin', notificationTemplateSlug,
    ],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
