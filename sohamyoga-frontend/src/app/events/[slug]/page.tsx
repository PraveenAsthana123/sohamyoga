// Real public event/webinar/workshop page — Module 19. Server component:
// fetches the published event by slug, renders capacity/full state honestly,
// and embeds a real registration form wired to the capacity-enforced API.
import { notFound } from 'next/navigation';
import { databaseConfigured, query } from '@/lib/postgres';
import RegisterForm from './RegisterForm';

export const dynamic = 'force-dynamic';

interface EventRow {
  id: string; title: string; description: string; type: string; format: string;
  location: string | null; join_url: string | null; starts_at: Date; ends_at: Date;
  capacity: number | null; status: string; registration_count: number;
}

async function getEvent(slug: string): Promise<EventRow | null> {
  if (!databaseConfigured()) return null;
  const result = await query<EventRow>(
    `SELECT id, title, description, type::text, format::text, location, join_url, starts_at, ends_at,
            capacity, status::text, registration_count
     FROM event WHERE slug = $1`,
    [slug],
  );
  return result.rows[0] ?? null;
}

export default async function EventPage({ params }: { params: { slug: string } }) {
  const event = await getEvent(params.slug);
  if (!event || event.status !== 'published') notFound();

  const isFull = event.capacity !== null && event.registration_count >= event.capacity;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{event.type}</span>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">{event.title}</h1>
        <p className="mt-2 text-gray-500">
          {new Date(event.starts_at).toLocaleString()} – {new Date(event.ends_at).toLocaleTimeString()}
        </p>
        <p className="mt-1 text-gray-500">{event.format === 'online' ? 'Online' : event.location}</p>
        {event.description && <p className="mt-6 whitespace-pre-wrap text-gray-700">{event.description}</p>}

        <div className="mt-10 border-t pt-8">
          {isFull ? (
            <p className="text-amber-700 font-medium">This event is full.</p>
          ) : (
            <RegisterForm eventId={event.id} />
          )}
          {event.capacity && (
            <p className="mt-3 text-xs text-gray-400">{event.registration_count} / {event.capacity} registered</p>
          )}
        </div>
      </div>
    </div>
  );
}
