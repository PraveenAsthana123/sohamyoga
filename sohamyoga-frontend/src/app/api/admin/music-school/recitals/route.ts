import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT r.*,COUNT(p.id) AS performer_count
       FROM ms_recital r
       LEFT JOIN ms_recital_performer p ON p.recital_id=r.id
       GROUP BY r.id ORDER BY r.event_date DESC`
    );
    return Response.json({ recitals: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO ms_recital (title,event_date,venue,description,ticket_price,status)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.title,body.event_date,body.venue,body.description,body.ticket_price||0,body.status||'planning']
    );
    return Response.json({ recital: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
