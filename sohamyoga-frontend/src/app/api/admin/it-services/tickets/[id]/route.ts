import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT t.*, c.name AS client_name FROM it_ticket t LEFT JOIN it_client c ON c.id=t.client_id WHERE t.id=$1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Ticket not found.' }, { status: 404 });
    return Response.json({ ticket: rows[0] });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid body.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const firstResponse = body.status === 'in_progress' ? 'COALESCE(first_response_at, NOW())' : 'first_response_at';
    const { rows } = await client.query(
      `UPDATE it_ticket SET status=COALESCE($2,status), priority=COALESCE($3,priority), assigned_to=COALESCE($4,assigned_to), category=COALESCE($5,category), sla_breach=COALESCE($6,sla_breach), resolution_notes=COALESCE($7,resolution_notes), time_spent_minutes=COALESCE($8,time_spent_minutes), first_response_at=${firstResponse} WHERE id=$1 RETURNING *`,
      [params.id, body.status, body.priority, body.assigned_to, body.category, body.sla_breach, body.resolution_notes, body.time_spent_minutes]
    );
    if (!rows.length) return Response.json({ error: 'Ticket not found.' }, { status: 404 });
    return Response.json({ ticket: rows[0] });
  } finally {
    client.release();
  }
}
