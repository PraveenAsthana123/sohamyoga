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
    const { rows } = await client.query(
      `SELECT *, NOW()-created_at AS wait_duration
       FROM st_client WHERE status='waitlist' ORDER BY created_at ASC`
    );
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { id } = await req.json();
    const { rows } = await client.query(
      `UPDATE st_client SET status='active' WHERE id=$1 AND status='waitlist' RETURNING *`, [id]
    );
    if (!rows[0]) return Response.json({ error: 'Client not found on waitlist' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
