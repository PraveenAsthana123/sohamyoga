export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const rows = q
      ? (await client.query(`SELECT * FROM sales_knowledge_base WHERE title ILIKE $1 OR content ILIKE $1 OR $1=ANY(tags) ORDER BY usage_count DESC`, [`%${q}%`])).rows
      : (await client.query('SELECT * FROM sales_knowledge_base ORDER BY usage_count DESC')).rows;
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO sales_knowledge_base (title, category, content, tags)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [body.title, body.category, body.content, body.tags || []]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
