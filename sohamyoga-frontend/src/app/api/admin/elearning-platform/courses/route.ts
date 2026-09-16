import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS el_course (
        id SERIAL PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE,
        description TEXT, instructor_id INTEGER REFERENCES el_instructor(id),
        category TEXT NOT NULL CHECK (category IN ('business','technology','marketing','design','health','finance','language','trades','personal_development','other')),
        level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner','intermediate','advanced','all_levels')),
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived')),
        thumbnail_url TEXT, intro_video_url TEXT,
        duration_hours DECIMAL(6,2), lessons_count INTEGER DEFAULT 0,
        enrolled_count INTEGER DEFAULT 0, avg_rating DECIMAL(3,2),
        certificate_enabled BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const instructor_id = searchParams.get('instructor_id');
  const conditions: string[] = ["c.status != 'archived' OR $1::boolean"];
  const values: unknown[] = [status === 'archived'];
  let idx = 2;
  const filters: string[] = [];
  if (category) { filters.push(`c.category = $${idx++}`); values.push(category); }
  if (status) { filters.push(`c.status = $${idx++}`); values.push(status); }
  if (instructor_id) { filters.push(`c.instructor_id = $${idx++}`); values.push(instructor_id); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT c.*, i.first_name AS instructor_first, i.last_name AS instructor_last
       FROM el_course c
       LEFT JOIN el_instructor i ON c.instructor_id = i.id
       ${where} ORDER BY c.created_at DESC LIMIT 200`,
      values.slice(1)
    );
    return Response.json({ courses: result.rows });
  } catch {
    // retry without the archived filter logic
    const result2 = await client.query(
      `SELECT c.*, i.first_name AS instructor_first, i.last_name AS instructor_last
       FROM el_course c
       LEFT JOIN el_instructor i ON c.instructor_id = i.id
       ORDER BY c.created_at DESC LIMIT 200`
    );
    return Response.json({ courses: result2.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { title, description, instructor_id, category, level = 'beginner', price = 0, thumbnail_url, intro_video_url, duration_hours, lessons_count = 0, certificate_enabled = true } = body;
  if (!title || !category) return Response.json({ error: 'title and category required' }, { status: 400 });
  const slug = slugify(title);
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO el_course (title, slug, description, instructor_id, category, level, price, thumbnail_url, intro_video_url, duration_hours, lessons_count, certificate_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [title, slug, description, instructor_id, category, level, price, thumbnail_url, intro_video_url, duration_hours, lessons_count, certificate_enabled]
    );
    return Response.json({ course: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
