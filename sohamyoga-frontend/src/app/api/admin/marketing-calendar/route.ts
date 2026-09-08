import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_TENANT_ID = '16fb3a23-5370-4572-bc93-2076534a4e99';

/**
 * Real content_calendar_entry CRUD (src/domain/marketing/db-schema.sql).
 * Prior audit found this table had a real schema but 0 rows and no admin
 * UI -- schema existed but was never populated or exercised. This is the
 * first real read/write surface for it: a unified editorial calendar
 * across social, email, SMS, blog, banner, event, workshop, and retreat
 * content, distinct from /admin/social/calendar (which only aggregates
 * social_post rows for the social scheduler).
 *
 * GET  lists entries plus the lookup data (campaign briefs, status codes)
 *      the admin form needs to create/edit one.
 * POST creates a new entry. Never seeds fake "already scheduled" rows --
 *      an empty calendar with real CRUD is the correct state until an
 *      admin actually plans content.
 */
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [entries, briefs, statuses, variants] = await Promise.all([
    query<{
      id: string; title: string; content_type: string; channel: string | null;
      scheduled_at: string; status: string; brief_id: string | null; brief_name: string | null;
      content_variant_id: string | null; assigned_to: string | null; tags: string[]; notes: string | null;
      created_by: string; created_at: string; updated_at: string;
      variant_platform: string | null; variant_content: string | null;
    }>(
      `SELECT c.id, c.title, c.content_type, c.channel, c.scheduled_at, c.status,
              c.brief_id, cb.name AS brief_name, c.content_variant_id, c.assigned_to,
              c.tags, c.notes, c.created_by, c.created_at, c.updated_at,
              cv.platform AS variant_platform, cv.adapted_content AS variant_content
       FROM content_calendar_entry c
       LEFT JOIN campaign_brief cb ON cb.id = c.brief_id
       LEFT JOIN content_variant cv ON cv.id = c.content_variant_id
       WHERE c.tenant_id = $1
       ORDER BY c.scheduled_at ASC`,
      [DEMO_TENANT_ID],
    ),
    query<{ id: string; name: string }>(
      `SELECT id, name FROM campaign_brief WHERE tenant_id = $1 ORDER BY name ASC`,
      [DEMO_TENANT_ID],
    ),
    query<{ code: string; label: string }>(`SELECT code, label FROM ref_calendar_entry_status ORDER BY code`),
    // Real content-variant picker source -- content_calendar_entry.content_variant_id
    // existed in the schema but had no UI to ever set it (module_registry:
    // content-calendar's own documented gap, and the root of post-management's
    // "no unified generic post entity across content types" -- a calendar
    // entry with no linked content is scheduling metadata, not a post).
    query<{ id: string; platform: string; adapted_content: string; brief_id: string | null }>(
      `SELECT id, platform, adapted_content, brief_id FROM content_variant WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [DEMO_TENANT_ID],
    ),
  ]);

  return Response.json({
    entries: entries.rows.map(e => ({
      id: e.id, title: e.title, contentType: e.content_type, channel: e.channel,
      scheduledAt: e.scheduled_at, status: e.status, briefId: e.brief_id, briefName: e.brief_name,
      contentVariantId: e.content_variant_id, assignedTo: e.assigned_to, tags: e.tags, notes: e.notes,
      createdBy: e.created_by, createdAt: e.created_at, updatedAt: e.updated_at,
      contentPreview: e.content_variant_id ? { platform: e.variant_platform, content: e.variant_content?.slice(0, 240) ?? null } : null,
    })),
    briefs: briefs.rows,
    statuses: statuses.rows,
    variants: variants.rows.map(v => ({ id: v.id, platform: v.platform, preview: v.adapted_content.slice(0, 80), briefId: v.brief_id })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    title?: string; contentType?: string; channel?: string | null; scheduledAt?: string;
    status?: string; briefId?: string | null; assignedTo?: string | null;
    tags?: string[]; notes?: string | null; contentVariantId?: string | null;
  } | null;

  if (!body?.title?.trim() || !body.contentType || !body.scheduledAt) {
    return Response.json({ error: 'title, contentType and scheduledAt are required.' }, { status: 400 });
  }

  const created = await query<{ id: string }>(
    `INSERT INTO content_calendar_entry
       (tenant_id, title, content_type, channel, scheduled_at, status, brief_id, assigned_to, tags, notes, created_by, content_variant_id)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'planned'), $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      DEMO_TENANT_ID, body.title.trim(), body.contentType, body.channel ?? null, body.scheduledAt,
      body.status ?? null, body.briefId ?? null, body.assignedTo ?? null, body.tags ?? [], body.notes ?? null,
      principal?.email ?? 'admin', body.contentVariantId ?? null,
    ],
  );

  return Response.json({ id: created.rows[0].id }, { status: 201 });
}
