import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await req.json();

    if (body.action === 'sync') {
      const result = await pool.query(
        `UPDATE calendar_integration SET last_sync_at=NOW(), sync_status='synced', events_synced=events_synced+1
         WHERE id=$1 RETURNING *`,
        [id]
      );
      return Response.json({ integration: result.rows[0] });
    }

    if (body.action === 'toggle') {
      const result = await pool.query(
        `UPDATE calendar_integration SET is_enabled=NOT is_enabled WHERE id=$1 RETURNING *`,
        [id]
      );
      return Response.json({ integration: result.rows[0] });
    }

    const { is_enabled, sync_direction, calendar_name } = body;
    const result = await pool.query(
      `UPDATE calendar_integration SET
        is_enabled=COALESCE($2,is_enabled),
        sync_direction=COALESCE($3,sync_direction),
        calendar_name=COALESCE($4,calendar_name)
       WHERE id=$1 RETURNING *`,
      [id, is_enabled, sync_direction, calendar_name]
    );
    return Response.json({ integration: result.rows[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    await pool.query('DELETE FROM calendar_integration WHERE id=$1', [id]);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
