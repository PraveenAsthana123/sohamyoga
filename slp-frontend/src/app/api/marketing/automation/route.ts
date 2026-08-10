import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INDUSTRIES = new Set(['yoga','dental','retail','restaurant','professional_services','other']);
const ASSET_TYPES = new Set(['copy','static_banner','dynamic_banner','video_script','video','thumbnail']);
const CHANNELS = new Set(['facebook','instagram','linkedin','x_twitter','threads','tiktok','youtube','pinterest','reddit','bluesky','google_business','email','sms']);

function tenantId(req: NextRequest, supplied?: string): string | null {
  const id = supplied || req.nextUrl.searchParams.get('tenantId') || req.headers.get('x-tenant-id');
  return id && UUID.test(id) ? id : null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const tenant = tenantId(req);
  if (!tenant) return Response.json({ error: 'A valid tenantId is required.' }, { status: 400 });
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [profile, channels, requests] = await Promise.all([
    query(`SELECT * FROM marketing_business_profile WHERE tenant_id=$1`, [tenant]),
    query(`SELECT channel, enabled, connection_status, provider, capabilities FROM tenant_channel_config WHERE tenant_id=$1 ORDER BY channel`, [tenant]),
    query(`SELECT * FROM v_marketing_automation_dashboard WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50`, [tenant]),
  ]);
  return Response.json({ profile: profile.rows[0] || null, channels: channels.rows, requests: requests.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const tenant = tenantId(req, typeof body?.tenantId === 'string' ? body.tenantId : undefined);
  if (!body || !tenant) return Response.json({ error: 'A valid tenantId is required.' }, { status: 400 });

  if (body.action === 'save_profile') {
    const industry = typeof body.industry === 'string' && INDUSTRIES.has(body.industry) ? body.industry : 'other';
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
    if (!businessName) return Response.json({ error: 'Business name is required.' }, { status: 400 });
    await query(
      `INSERT INTO marketing_business_profile
       (tenant_id, industry, business_name, audience, value_proposition, website_url, default_timezone, approval_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id) DO UPDATE SET industry=EXCLUDED.industry,
       business_name=EXCLUDED.business_name, audience=EXCLUDED.audience,
       value_proposition=EXCLUDED.value_proposition, website_url=EXCLUDED.website_url,
       default_timezone=EXCLUDED.default_timezone, approval_required=EXCLUDED.approval_required, updated_at=now()`,
      [tenant, industry, businessName, String(body.audience || ''), String(body.valueProposition || ''),
        body.websiteUrl || null, String(body.timezone || 'America/Edmonton'), body.approvalRequired !== false],
    );
    return Response.json({ ok: true });
  }

  if (body.action === 'set_channel') {
    const channel = typeof body.channel === 'string' ? body.channel : '';
    if (!CHANNELS.has(channel)) return Response.json({ error: 'Unsupported channel.' }, { status: 400 });
    await query(
      `INSERT INTO tenant_channel_config (tenant_id, channel, enabled, provider)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (tenant_id, channel) DO UPDATE SET enabled=EXCLUDED.enabled,
       provider=EXCLUDED.provider, updated_at=now()`,
      [tenant, channel, Boolean(body.enabled), String(body.provider || 'postiz')],
    );
    return Response.json({ ok: true });
  }

  if (body.action === 'create_campaign') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const industry = typeof body.industry === 'string' && INDUSTRIES.has(body.industry) ? body.industry : 'other';
    const assetTypes = Array.isArray(body.assetTypes) ? body.assetTypes.filter(v => typeof v === 'string' && ASSET_TYPES.has(v)) : [];
    const channels = Array.isArray(body.channels) ? body.channels.filter(v => typeof v === 'string' && CHANNELS.has(v)) : [];
    if (!title || !assetTypes.length || !channels.length) {
      return Response.json({ error: 'Title, at least one asset, and at least one channel are required.' }, { status: 400 });
    }
    const enabledChannels = await query<{ channel: string }>(
      `SELECT channel FROM tenant_channel_config WHERE tenant_id=$1 AND enabled=TRUE AND channel=ANY($2::text[])`,
      [tenant, channels],
    );
    const allowed = new Set(enabledChannels.rows.map(row => row.channel));
    const disabled = channels.filter(channel => !allowed.has(channel));
    if (disabled.length) {
      return Response.json({ error: `Enable these channels before using them: ${disabled.join(', ')}` }, { status: 400 });
    }
    const id = await transaction(async client => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO marketing_automation_request
         (tenant_id, title, industry, objective, audience, offer_text, call_to_action,
          asset_types, channels, scheduled_at, timezone, model_name, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'queued') RETURNING id`,
        [tenant, title, industry, String(body.objective || 'awareness'), String(body.audience || ''),
          String(body.offerText || ''), String(body.callToAction || ''), assetTypes, channels,
          body.scheduledAt || null, String(body.timezone || 'America/Edmonton'), body.modelName || null],
      );
      await client.query(
        `INSERT INTO marketing_workflow_event (tenant_id, request_id, stage, status, actor_type, message)
         VALUES ($1,$2,'brief','queued','user','Campaign brief submitted for local AI generation')`,
        [tenant, result.rows[0].id],
      );
      return result.rows[0].id;
    });
    return Response.json({ ok: true, id }, { status: 201 });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
