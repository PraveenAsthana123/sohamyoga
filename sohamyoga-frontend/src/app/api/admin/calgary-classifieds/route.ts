import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import type { PoolClient } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = [
  'kijiji','craigslist','facebook_marketplace','usedcalgary',
  'calgary_herald','zumper','autotrader','realtor_ca','oodle','indeed',
];

async function provision(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS calgary_listing (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      price NUMERIC(10,2),
      price_type TEXT DEFAULT 'fixed',
      description TEXT,
      location TEXT DEFAULT 'Calgary, AB',
      neighbourhood TEXT,
      images TEXT[],
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      status TEXT DEFAULT 'draft',
      tags TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS calgary_listing_platform (
      id SERIAL PRIMARY KEY,
      listing_id INT REFERENCES calgary_listing(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      platform_url TEXT,
      platform_ad_id TEXT,
      posted_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      views_count INT DEFAULT 0,
      responses_count INT DEFAULT 0,
      notes TEXT,
      UNIQUE(listing_id, platform)
    );
    CREATE TABLE IF NOT EXISTS calgary_classifieds_lead (
      id SERIAL PRIMARY KEY,
      listing_id INT REFERENCES calgary_listing(id),
      platform TEXT,
      name TEXT, email TEXT, phone TEXT,
      message TEXT,
      status TEXT DEFAULT 'new',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);
    const url = new URL(req.url);
    const category = url.searchParams.get('category') || '';
    const status = url.searchParams.get('status') || '';
    const neighbourhood = url.searchParams.get('neighbourhood') || '';
    const search = url.searchParams.get('search') || '';

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (category) { conditions.push(`l.category = $${idx++}`); values.push(category); }
    if (status) { conditions.push(`l.status = $${idx++}`); values.push(status); }
    if (neighbourhood) { conditions.push(`l.neighbourhood = $${idx++}`); values.push(neighbourhood); }
    if (search) { conditions.push(`(l.title ILIKE $${idx} OR l.description ILIKE $${idx})`); values.push(`%${search}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const listingsRes = await client.query(`
      SELECT l.*,
        COALESCE(
          json_agg(
            json_build_object(
              'platform', p.platform,
              'status', p.status,
              'platform_url', p.platform_url,
              'platform_ad_id', p.platform_ad_id,
              'posted_at', p.posted_at,
              'expires_at', p.expires_at,
              'views_count', p.views_count,
              'responses_count', p.responses_count,
              'notes', p.notes
            ) ORDER BY p.platform
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS platform_statuses
      FROM calgary_listing l
      LEFT JOIN calgary_listing_platform p ON p.listing_id = l.id
      ${where}
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT 200
    `, values);

    const statsRes = await client.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='active') AS active,
        (SELECT COUNT(*) FROM calgary_classifieds_lead) AS total_leads,
        (SELECT COUNT(DISTINCT platform) FROM calgary_listing_platform WHERE status='posted') AS platforms_posted
      FROM calgary_listing
    `);

    return Response.json({ listings: listingsRes.rows, stats: statsRes.rows[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid body.' }, { status: 400 });
  const { title, category, subcategory, price, price_type, description, location, neighbourhood,
    images, contact_name, contact_email, contact_phone, tags } = body as Record<string, unknown>;
  if (!title || !category) return Response.json({ error: 'title and category required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);
    await client.query('BEGIN');
    const listRes = await client.query(`
      INSERT INTO calgary_listing
        (title, category, subcategory, price, price_type, description, location, neighbourhood,
         images, contact_name, contact_email, contact_phone, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [title, category, subcategory ?? null, price ?? null, price_type ?? 'fixed',
        description ?? null, location ?? 'Calgary, AB', neighbourhood ?? null,
        images ?? null, contact_name ?? null, contact_email ?? null, contact_phone ?? null,
        tags ?? null]);
    const listing = listRes.rows[0];

    for (const platform of PLATFORMS) {
      await client.query(`
        INSERT INTO calgary_listing_platform (listing_id, platform, status)
        VALUES ($1, $2, 'pending')
        ON CONFLICT (listing_id, platform) DO NOTHING
      `, [listing.id, platform]);
    }
    await client.query('COMMIT');
    return Response.json({ listing }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('calgary-classifieds POST:', err);
    return Response.json({ error: 'Failed to create listing.' }, { status: 500 });
  } finally {
    client.release();
  }
}
