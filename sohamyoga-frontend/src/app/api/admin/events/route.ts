import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['draft', 'published', 'cancelled', 'completed'];
const VALID_TYPES = ['event', 'webinar', 'workshop', 'seminar'];
const VALID_FORMATS = ['online', 'in_person', 'hybrid'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const filter = url.searchParams.get('filter'); // 'upcoming' | 'past' | null

  const client = await pool.connect();
  try {
    const tenantId = await getPrimaryTenantId();

    const whereFilter =
      filter === 'upcoming'
        ? 'AND e.starts_at >= now()'
        : filter === 'past'
        ? 'AND e.ends_at < now()'
        : '';

    const eventsResult = await client.query<{
      id: string;
      slug: string;
      title: string;
      description: string;
      type: string;
      format: string;
      location: string | null;
      join_url: string | null;
      starts_at: string;
      ends_at: string;
      capacity: number | null;
      status: string;
      registration_count: number;
      created_by: string;
      created_at: string;
      updated_at: string;
      reg_count: string;
    }>(
      `SELECT e.id, e.slug, e.title, e.description, e.type, e.format,
              e.location, e.join_url, e.starts_at, e.ends_at, e.capacity,
              e.status, e.registration_count, e.created_by, e.created_at, e.updated_at,
              COALESCE(r.cnt, 0)::text AS reg_count
       FROM event e
       LEFT JOIN (
         SELECT event_id, count(*) AS cnt
         FROM event_registration
         GROUP BY event_id
       ) r ON r.event_id = e.id
       WHERE e.tenant_id = $1 ${whereFilter}
       ORDER BY e.starts_at DESC
       LIMIT 200`,
      [tenantId],
    );

    const statsResult = await client.query<{
      total: string;
      upcoming: string;
      past: string;
      total_regs: string;
    }>(
      `SELECT
         count(*)::text AS total,
         count(*) FILTER (WHERE starts_at >= now())::text AS upcoming,
         count(*) FILTER (WHERE ends_at < now())::text AS past,
         COALESCE(sum(registration_count), 0)::text AS total_regs
       FROM event WHERE tenant_id = $1`,
      [tenantId],
    );

    return Response.json({
      events: eventsResult.rows,
      summary: statsResult.rows[0] ?? { total: '0', upcoming: '0', past: '0', total_regs: '0' },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as {
    slug?: string;
    title?: string;
    description?: string;
    type?: string;
    format?: string;
    location?: string;
    join_url?: string;
    starts_at?: string;
    ends_at?: string;
    capacity?: number;
  } | null;

  if (!body?.slug || !body?.title || !body?.starts_at || !body?.ends_at) {
    return Response.json({ error: 'slug, title, starts_at, and ends_at are required.' }, { status: 400 });
  }
  if (body.type && !VALID_TYPES.includes(body.type)) {
    return Response.json({ error: `type must be one of ${VALID_TYPES.join('|')}` }, { status: 400 });
  }
  if (body.format && !VALID_FORMATS.includes(body.format)) {
    return Response.json({ error: `format must be one of ${VALID_FORMATS.join('|')}` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const tenantId = await getPrimaryTenantId();
    const result = await client.query(
      `INSERT INTO event
         (tenant_id, slug, title, description, type, format, location, join_url, starts_at, ends_at, capacity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'admin')
       RETURNING *`,
      [
        tenantId,
        body.slug,
        body.title,
        body.description ?? '',
        body.type ?? 'event',
        body.format ?? 'online',
        body.location ?? null,
        body.join_url ?? null,
        body.starts_at,
        body.ends_at,
        body.capacity ?? null,
      ],
    );
    return Response.json({ event: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id) return Response.json({ error: 'id is required.' }, { status: 400 });
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return Response.json({ error: `status must be one of ${VALID_STATUSES.join('|')}` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE event SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, title, status`,
      [body.status, body.id],
    );
    if (!result.rowCount) return Response.json({ error: 'Event not found.' }, { status: 404 });
    return Response.json({ event: result.rows[0] });
  } finally {
    client.release();
  }
}
