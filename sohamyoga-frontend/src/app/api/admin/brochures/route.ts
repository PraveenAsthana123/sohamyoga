import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS brochures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'product',
        file_url TEXT,
        thumbnail_url TEXT,
        version TEXT DEFAULT '1.0',
        status TEXT DEFAULT 'draft',
        download_count INT DEFAULT 0,
        tags TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows } = await client.query(`SELECT COUNT(*) AS cnt FROM brochures`);
    if (parseInt(rows[0].cnt) === 0) {
      await client.query(`
        INSERT INTO brochures (title, description, category, file_url, thumbnail_url, version, status, download_count, tags)
        VALUES
          ('Soham Yoga Services Overview', 'Complete guide to our yoga and wellness offerings for studios and corporate clients.', 'service',
           'https://cdn.sohamyoga.ca/brochures/services-2026.pdf', 'https://cdn.sohamyoga.ca/thumbnails/services-cover.jpg',
           '2.1', 'published', 142, ARRAY['yoga', 'wellness', 'corporate', 'services']),

          ('Corporate Wellness Program', 'Tailored wellness programs for enterprises — on-site and virtual delivery options.', 'product',
           'https://cdn.sohamyoga.ca/brochures/corporate-wellness.pdf', 'https://cdn.sohamyoga.ca/thumbnails/corporate-cover.jpg',
           '1.3', 'published', 87, ARRAY['corporate', 'enterprise', 'b2b', 'wellness']),

          ('Summer Retreat 2026 — Event Guide', 'Full details about our annual 7-day retreat: schedule, pricing, accommodation, instructors.', 'event',
           'https://cdn.sohamyoga.ca/brochures/retreat-2026.pdf', 'https://cdn.sohamyoga.ca/thumbnails/retreat-cover.jpg',
           '1.0', 'published', 34, ARRAY['retreat', 'event', '2026', 'summer']),

          ('Brand Story & Company Profile', 'Our founding story, mission, values, and key team members.', 'company',
           NULL, NULL,
           '1.0', 'draft', 0, ARRAY['brand', 'about', 'company'])
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT id, title, description, category, file_url, thumbnail_url,
             version, status, download_count, tags, created_at, updated_at
      FROM brochures
      ORDER BY created_at DESC
    `);
    return Response.json({ brochures: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const body = await req.json().catch(() => null) as {
    title?: string; description?: string; category?: string;
    file_url?: string; thumbnail_url?: string; version?: string;
    status?: string; tags?: string[];
  } | null;

  if (!body?.title) {
    return Response.json({ error: 'title is required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      INSERT INTO brochures (title, description, category, file_url, thumbnail_url, version, status, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      body.title,
      body.description || null,
      body.category || 'product',
      body.file_url || null,
      body.thumbnail_url || null,
      body.version || '1.0',
      body.status || 'draft',
      body.tags && body.tags.length ? body.tags : null,
    ]);
    return Response.json({ brochure: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
