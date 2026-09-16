import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS meetup_group (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  city TEXT DEFAULT 'Calgary',
  province TEXT DEFAULT 'AB',
  meeting_frequency TEXT DEFAULT 'monthly',
  typical_venue TEXT,
  max_members INT DEFAULT 100,
  current_members INT DEFAULT 0,
  organizer_name TEXT,
  organizer_email TEXT,
  meetup_url TEXT,
  facebook_group_url TEXT,
  linkedin_group_url TEXT,
  discord_invite_url TEXT,
  whatsapp_group_url TEXT,
  eventbrite_organizer_url TEXT,
  is_free BOOLEAN DEFAULT true,
  membership_fee NUMERIC(8,2),
  status TEXT DEFAULT 'active',
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meetup_event (
  id SERIAL PRIMARY KEY,
  group_id INT REFERENCES meetup_group(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'in_person',
  category TEXT,
  venue_name TEXT,
  venue_address TEXT,
  city TEXT DEFAULT 'Calgary',
  google_meet_url TEXT,
  zoom_url TEXT,
  platform TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  timezone TEXT DEFAULT 'America/Edmonton',
  max_attendees INT,
  rsvp_deadline TIMESTAMPTZ,
  waitlist_enabled BOOLEAN DEFAULT false,
  is_free BOOLEAN DEFAULT true,
  price NUMERIC(8,2),
  eventbrite_url TEXT,
  posted_to TEXT[],
  status TEXT DEFAULT 'draft',
  actual_attendees INT,
  recording_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meetup_rsvp (
  id SERIAL PRIMARY KEY,
  event_id INT REFERENCES meetup_event(id) ON DELETE CASCADE,
  group_id INT REFERENCES meetup_group(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'direct',
  status TEXT DEFAULT 'going',
  dietary_requirements TEXT,
  notes TEXT,
  rsvp_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meetup_member (
  id SERIAL PRIMARY KEY,
  group_id INT REFERENCES meetup_group(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  joined_date DATE DEFAULT CURRENT_DATE,
  source TEXT,
  events_attended INT DEFAULT 0,
  last_attended DATE,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'active',
  interests TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(INIT_SQL);
  } finally {
    client.release();
  }
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables();

    const groupsRes = await client.query(`
      SELECT
        g.*,
        (SELECT COUNT(*) FROM meetup_event e WHERE e.group_id = g.id AND e.status != 'archived') AS event_count,
        (SELECT COUNT(*) FROM meetup_member m WHERE m.group_id = g.id AND m.status = 'active') AS member_count_live
      FROM meetup_group g
      WHERE g.status != 'archived'
      ORDER BY g.name
    `);

    const now = new Date().toISOString();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const statsRes = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM meetup_group WHERE status = 'active') AS total_groups,
        (SELECT COUNT(*) FROM meetup_member WHERE status = 'active') AS total_members,
        (SELECT COUNT(*) FROM meetup_event WHERE start_time >= $1 AND status != 'cancelled') AS events_this_month,
        (SELECT COUNT(*) FROM meetup_event WHERE start_time > $2 AND status = 'published') AS upcoming_events,
        (SELECT COUNT(*) FROM meetup_rsvp r JOIN meetup_event e ON e.id = r.event_id WHERE r.rsvp_at >= $1) AS total_rsvps_this_month
    `, [monthStart.toISOString(), now]);

    const categoryRes = await client.query(`
      SELECT
        g.category,
        COUNT(DISTINCT g.id) AS count,
        SUM(COALESCE(m.member_count, 0)) AS members
      FROM meetup_group g
      LEFT JOIN (
        SELECT group_id, COUNT(*) AS member_count FROM meetup_member WHERE status = 'active' GROUP BY group_id
      ) m ON m.group_id = g.id
      WHERE g.status = 'active'
      GROUP BY g.category
      ORDER BY count DESC
    `);

    // Platform reach = count of non-null platform URLs across all groups
    const platformRes = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM meetup_group WHERE meetup_url IS NOT NULL AND status='active') +
        (SELECT COUNT(*) FROM meetup_group WHERE facebook_group_url IS NOT NULL AND status='active') +
        (SELECT COUNT(*) FROM meetup_group WHERE linkedin_group_url IS NOT NULL AND status='active') +
        (SELECT COUNT(*) FROM meetup_group WHERE discord_invite_url IS NOT NULL AND status='active') +
        (SELECT COUNT(*) FROM meetup_group WHERE whatsapp_group_url IS NOT NULL AND status='active') +
        (SELECT COUNT(*) FROM meetup_group WHERE eventbrite_organizer_url IS NOT NULL AND status='active') AS platform_reach
    `);

    const stats = {
      ...statsRes.rows[0],
      platform_reach: Number(platformRes.rows[0]?.platform_reach ?? 0),
      by_category: categoryRes.rows,
    };

    return Response.json({ groups: groupsRes.rows, stats });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const { name, category, subcategory, description, city, province, meeting_frequency,
    typical_venue, max_members, organizer_name, organizer_email, meetup_url,
    facebook_group_url, linkedin_group_url, discord_invite_url, whatsapp_group_url,
    eventbrite_organizer_url, is_free, membership_fee, tags } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || !name.trim()) return Response.json({ error: 'Name required.' }, { status: 400 });
  if (!category || typeof category !== 'string') return Response.json({ error: 'Category required.' }, { status: 400 });

  const slug = toSlug(name as string);

  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(`
      INSERT INTO meetup_group
        (name, slug, category, subcategory, description, city, province, meeting_frequency,
         typical_venue, max_members, organizer_name, organizer_email,
         meetup_url, facebook_group_url, linkedin_group_url, discord_invite_url,
         whatsapp_group_url, eventbrite_organizer_url, is_free, membership_fee, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `, [
      (name as string).trim(), slug, category, subcategory ?? null, description ?? null,
      city ?? 'Calgary', province ?? 'AB', meeting_frequency ?? 'monthly',
      typical_venue ?? null, max_members ?? 100, organizer_name ?? null, organizer_email ?? null,
      meetup_url ?? null, facebook_group_url ?? null, linkedin_group_url ?? null,
      discord_invite_url ?? null, whatsapp_group_url ?? null, eventbrite_organizer_url ?? null,
      is_free !== false, membership_fee ?? null,
      Array.isArray(tags) ? tags : [],
    ]);
    return Response.json({ group: res.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') return Response.json({ error: 'A group with that name already exists.' }, { status: 409 });
    throw err;
  } finally {
    client.release();
  }
}
