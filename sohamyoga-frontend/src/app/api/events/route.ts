import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { Event, type EventType, type EventFormat } from '@/domain/event/Event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT id, slug, title, type::text, format::text, location, join_url, starts_at, ends_at,
            capacity, status::text, registration_count, created_at
     FROM event WHERE tenant_id = $1 ORDER BY starts_at DESC`,
    [tenantId],
  );
  return Response.json({
    events: rows.rows.map(r => ({
      id: r.id, slug: r.slug, title: r.title, type: r.type, format: r.format,
      location: r.location, joinUrl: r.join_url, startsAt: r.starts_at, endsAt: r.ends_at,
      capacity: r.capacity, status: r.status, registrationCount: r.registration_count, createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    slug?: string; title?: string; description?: string; type?: string; format?: string;
    location?: string; joinUrl?: string; startsAt?: string; endsAt?: string; capacity?: number;
  } | null;
  if (!body?.slug || !body.title || !body.type || !body.format || !body.startsAt || !body.endsAt) {
    return Response.json({ error: 'slug, title, type, format, startsAt, and endsAt are required.' }, { status: 400 });
  }

  try {
    // Reuse the real domain class for validation before ever touching the DB.
    new Event({
      id: '00000000-0000-0000-0000-000000000000',
      slug: body.slug,
      title: body.title,
      description: body.description ?? '',
      type: body.type as EventType,
      format: body.format as EventFormat,
      location: body.location,
      joinUrl: body.joinUrl,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      capacity: body.capacity,
      status: 'draft',
      registrationCount: 0,
      createdBy: principal!.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid event data.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO event (tenant_id, slug, title, description, type, format, location, join_url, starts_at, ends_at, capacity, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [tenantId, body.slug, body.title, body.description ?? '', body.type, body.format,
        body.location ?? null, body.joinUrl ?? null, body.startsAt, body.endsAt, body.capacity ?? null, principal!.id],
    );
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'An event with this slug already exists.' : message }, { status });
  }
}
