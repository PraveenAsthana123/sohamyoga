import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { Event, type EventType, type EventFormat, type EventStatus } from '@/domain/event/Event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EventRow {
  id: string; slug: string; title: string; description: string; type: EventType; format: EventFormat;
  location: string | null; join_url: string | null; starts_at: Date; ends_at: Date; capacity: number | null;
  status: EventStatus; registration_count: number; created_by: string; created_at: Date; updated_at: Date;
}

async function loadEvent(id: string): Promise<Event | null> {
  const rows = await query<EventRow>(
    `SELECT id, slug, title, description, type::text, format::text, location, join_url, starts_at, ends_at,
            capacity, status::text, registration_count, created_by, created_at, updated_at
     FROM event WHERE id = $1`,
    [id],
  );
  if (!rows.rows.length) return null;
  const r = rows.rows[0];
  return new Event({
    id: r.id, slug: r.slug, title: r.title, description: r.description, type: r.type, format: r.format,
    location: r.location ?? undefined, joinUrl: r.join_url ?? undefined, startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at), capacity: r.capacity ?? undefined, status: r.status,
    registrationCount: r.registration_count, createdBy: r.created_by,
    createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: 'publish' | 'cancel' | 'complete' } | null;
  if (!body?.action || !['publish', 'cancel', 'complete'].includes(body.action)) {
    return Response.json({ error: 'action must be "publish", "cancel", or "complete".' }, { status: 400 });
  }

  const event = await loadEvent(params.id);
  if (!event) return Response.json({ error: 'Event not found.' }, { status: 404 });

  let next: Event;
  try {
    next = body.action === 'publish' ? event.publish() : body.action === 'cancel' ? event.cancel() : event.complete();
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
  }

  await query(`UPDATE event SET status = $2, updated_at = now() WHERE id = $1`, [event.id, next.status]);
  return Response.json({ ok: true, status: next.status });
}
