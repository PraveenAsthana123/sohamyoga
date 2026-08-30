import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { Event, type EventType, type EventFormat, type EventStatus } from '@/domain/event/Event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EventRow {
  id: string; tenant_id: string; slug: string; title: string; description: string; type: EventType; format: EventFormat;
  location: string | null; join_url: string | null; starts_at: Date; ends_at: Date; capacity: number | null;
  status: EventStatus; registration_count: number; created_by: string; created_at: Date; updated_at: Date;
}

// POST — public event/webinar registration, looked up by id or slug. Enforces
// capacity and publish-status via the real Event domain class (not just a raw
// COUNT check), inside a transaction so two concurrent registrations against
// the last open seat can't both succeed.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { name?: string; email?: string; phone?: string } | null;
  if (!body?.name?.trim()) return Response.json({ error: 'name is required.' }, { status: 400 });
  if (!body.email || !EMAIL_RE.test(body.email)) return Response.json({ error: 'A valid email is required.' }, { status: 400 });
  const name = body.name.trim();
  const email = body.email;
  const phone = body.phone;

  try {
    const result = await transaction(async client => {
      const rows = await client.query<EventRow>(
        `SELECT id, tenant_id, slug, title, description, type::text, format::text, location, join_url, starts_at, ends_at,
                capacity, status::text, registration_count, created_by, created_at, updated_at
         FROM event WHERE id::text = $1 OR slug = $1 FOR UPDATE`,
        [params.id],
      );
      if (!rows.rows.length) throw Object.assign(new Error('Event not found.'), { status: 404 });
      const r = rows.rows[0];
      const event = new Event({
        id: r.id, slug: r.slug, title: r.title, description: r.description, type: r.type, format: r.format,
        location: r.location ?? undefined, joinUrl: r.join_url ?? undefined, startsAt: new Date(r.starts_at),
        endsAt: new Date(r.ends_at), capacity: r.capacity ?? undefined, status: r.status,
        registrationCount: r.registration_count, createdBy: r.created_by,
        createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
      });

      if (!event.acceptsRegistrations) {
        throw Object.assign(new Error(event.status !== 'published' ? 'This event is not open for registration.' : 'This event is full.'), { status: 409 });
      }

      const leadResult = await client.query<{ id: string }>(
        `INSERT INTO campaign_lead (tenant_id, email, source_platform, funnel_stage, message)
         VALUES ($1, $2, 'event_registration', 'new', $3) RETURNING id`,
        [r.tenant_id, email, `Registered for: ${event.title}`],
      );

      await client.query(
        `INSERT INTO event_registration (event_id, name, email, phone, lead_id) VALUES ($1,$2,$3,$4,$5)`,
        [event.id, name, email, phone ?? null, leadResult.rows[0].id],
      );
      await client.query(`UPDATE event SET registration_count = registration_count + 1, updated_at = now() WHERE id = $1`, [event.id]);

      // Real journey touchpoint — Customer Journey & Funnel module.
      await client.query(
        `INSERT INTO journey_touchpoint (tenant_id, contact_identifier, touchpoint_type, source_module, metadata)
         VALUES ($1, $2, 'event_registration', 'event', $3)`,
        [r.tenant_id, email, JSON.stringify({ eventId: event.id, eventTitle: event.title })],
      );

      return { title: event.title, joinUrl: r.join_url };
    });

    return Response.json({ ok: true, message: `You're registered for ${result.title}.`, joinUrl: result.joinUrl }, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? (String(err).includes('duplicate key') ? 409 : 502);
    const message = status === 409 && String(err).includes('duplicate key')
      ? 'This email is already registered for this event.'
      : err instanceof Error ? err.message : 'Registration failed.';
    return Response.json({ error: message }, { status });
  }
}
