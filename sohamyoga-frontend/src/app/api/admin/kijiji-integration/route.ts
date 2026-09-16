import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS kijiji_listings (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        price NUMERIC(10,2),
        price_type TEXT DEFAULT 'fixed',
        description TEXT,
        location_city TEXT,
        location_province TEXT DEFAULT 'ON',
        images TEXT[],
        contact_method TEXT DEFAULT 'email',
        phone TEXT,
        status TEXT DEFAULT 'draft',
        kijiji_url TEXT,
        kijiji_ad_id TEXT,
        views_count INT DEFAULT 0,
        responses_count INT DEFAULT 0,
        posted_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        auto_renew BOOLEAN DEFAULT false,
        tags TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTable();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');

    const conditions: string[] = ["status != 'deleted'"];
    const values: unknown[] = [];
    let idx = 1;

    if (status && status !== 'all') {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }
    if (category && category !== 'all') {
      conditions.push(`category = $${idx++}`);
      values.push(category);
    }
    if (search) {
      conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await client.query(
      `SELECT id, title, category, subcategory, price, price_type, description,
              location_city, location_province, images, contact_method, phone,
              status, kijiji_url, kijiji_ad_id, views_count, responses_count,
              posted_at, expires_at, auto_renew, tags, created_at, updated_at
       FROM kijiji_listings ${where} ORDER BY created_at DESC`,
      values,
    );

    const statsRow = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status != 'deleted') AS total,
         COUNT(*) FILTER (WHERE status = 'draft') AS draft,
         COUNT(*) FILTER (WHERE status = 'ready') AS ready,
         COUNT(*) FILTER (WHERE status = 'posted') AS posted,
         COUNT(*) FILTER (WHERE status = 'expired') AS expired
       FROM kijiji_listings`,
    );
    const s = statsRow.rows[0];

    return Response.json({
      listings: rows.rows,
      stats: {
        total: Number(s.total),
        draft: Number(s.draft),
        ready: Number(s.ready),
        posted: Number(s.posted),
        expired: Number(s.expired),
      },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTable();

  const body = await req.json().catch(() => null) as {
    title?: string; category?: string; subcategory?: string;
    price?: number; price_type?: string; description?: string;
    location_city?: string; location_province?: string;
    images?: string[]; contact_method?: string; phone?: string;
    status?: string; tags?: string[]; auto_renew?: boolean;
  } | null;

  if (!body?.title || !body?.category) {
    return Response.json({ error: 'title and category are required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO kijiji_listings
         (title, category, subcategory, price, price_type, description,
          location_city, location_province, images, contact_method, phone,
          status, tags, auto_renew)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        body.title,
        body.category,
        body.subcategory ?? null,
        body.price ?? null,
        body.price_type ?? 'fixed',
        body.description ?? null,
        body.location_city ?? null,
        body.location_province ?? 'ON',
        body.images ?? [],
        body.contact_method ?? 'email',
        body.phone ?? null,
        body.status ?? 'draft',
        body.tags ?? [],
        body.auto_renew ?? false,
      ],
    );
    return Response.json({ listing: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
