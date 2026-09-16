import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM cf_deliverable WHERE engagement_id=$1 ORDER BY due_date`, [params.id]);
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO cf_deliverable (engagement_id, deliverable_name, deliverable_type, due_date, status, assigned_to, version, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [params.id, body.deliverable_name, body.deliverable_type, body.due_date || null,
       body.status || 'in_progress', body.assigned_to, body.version || '1.0', body.notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
