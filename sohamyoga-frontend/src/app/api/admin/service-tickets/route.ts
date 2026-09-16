import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  let query = 'SELECT * FROM service_ticket WHERE 1=1';
  const params: string[] = [];
  if (status) { query += ' AND status=$1'; params.push(status); }
  query += ' ORDER BY created_at DESC LIMIT 200';

  try {
    const result = await pool.query(query, params);
    return Response.json({ tickets: result.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { id, status, priority, assigned_agent, resolution_notes } = body;
    const resolved_at = status === 'resolved' ? new Date() : null;
    const result = await pool.query(
      `UPDATE service_ticket SET
        status=COALESCE($2,status),
        priority=COALESCE($3,priority),
        assigned_agent=COALESCE($4,assigned_agent),
        resolution_notes=COALESCE($5,resolution_notes),
        resolved_at=COALESCE($6,resolved_at)
       WHERE id=$1 RETURNING *`,
      [id, status, priority, assigned_agent, resolution_notes, resolved_at]
    );
    return Response.json({ ticket: result.rows[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
