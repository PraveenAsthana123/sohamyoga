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
      CREATE TABLE IF NOT EXISTS cw_visitor (
        id SERIAL PRIMARY KEY, host_member_id INTEGER REFERENCES cw_member(id),
        visitor_name TEXT NOT NULL, visitor_company TEXT, visit_purpose TEXT,
        scheduled_at TIMESTAMPTZ, checked_in_at TIMESTAMPTZ, checked_out_at TIMESTAMPTZ,
        badge_number TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT v.*, m.first_name AS host_first, m.last_name AS host_last, m.company AS host_company
       FROM cw_visitor v
       LEFT JOIN cw_member m ON v.host_member_id = m.id
       WHERE DATE(v.scheduled_at) = CURRENT_DATE
          OR DATE(v.checked_in_at) = CURRENT_DATE
          OR DATE(v.created_at) = CURRENT_DATE
       ORDER BY v.scheduled_at ASC NULLS LAST, v.created_at DESC`
    );
    return Response.json({ visitors: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { host_member_id, visitor_name, visitor_company, visit_purpose, scheduled_at } = body;
  if (!visitor_name) return Response.json({ error: 'visitor_name is required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO cw_visitor (host_member_id, visitor_name, visitor_company, visit_purpose, scheduled_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [host_member_id, visitor_name, visitor_company, visit_purpose, scheduled_at]
    );
    return Response.json({ visitor: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
