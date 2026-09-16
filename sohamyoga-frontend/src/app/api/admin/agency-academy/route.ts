export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTables(client: import('pg').PoolClient): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS academy_courses (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    modules JSONB DEFAULT '[]',
    duration_hours NUMERIC,
    level TEXT DEFAULT 'beginner',
    instructor TEXT,
    status TEXT DEFAULT 'draft',
    enrolled_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS academy_enrollments (
    id SERIAL PRIMARY KEY,
    course_slug TEXT NOT NULL REFERENCES academy_courses(slug) ON DELETE CASCADE,
    student_email TEXT NOT NULL,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    progress_pct INT DEFAULT 0,
    UNIQUE(course_slug, student_email)
  )`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const level = searchParams.get('level');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (category && category !== 'All') { params.push(category); conditions.push(`category=$${params.length}`); }
    if (level) { params.push(level); conditions.push(`level=$${params.length}`); }
    if (status) { params.push(status); conditions.push(`status=$${params.length}`); }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const r = await client.query(`SELECT * FROM academy_courses${where} ORDER BY created_at DESC`, params);
    return Response.json({ courses: r.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const { title, slug, category, description, modules, duration_hours, level, instructor } = body;
  if (!title || !slug || !category) return Response.json({ error: 'title, slug, category required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const r = await client.query(
      `INSERT INTO academy_courses (title, slug, category, description, modules, duration_hours, level, instructor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, slug, category, description || null, JSON.stringify(modules || []), duration_hours || null, level || 'beginner', instructor || null]
    );
    return Response.json(r.rows[0], { status: 201 });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') {
      return Response.json({ error: 'Slug already exists' }, { status: 409 });
    }
    throw e;
  } finally {
    client.release();
  }
}
