export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function PATCH(req: NextRequest, { params }: { params: { assetId: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json();
  const { content, status, approved_by } = body as { content?: string; status?: string; approved_by?: string };

  const pool = getPool();
  const client = await pool.connect();
  try {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (content !== undefined) { updates.push(`content=$${idx++}`); values.push(content); }
    if (status !== undefined) { updates.push(`status=$${idx++}`); values.push(status); }
    if (approved_by !== undefined && status === 'approved') {
      updates.push(`approved_by=$${idx++}`); values.push(approved_by);
      updates.push(`approved_at=NOW()`);
    }

    if (!updates.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    values.push(params.assetId);

    const { rows } = await client.query(
      `UPDATE repurpose_assets SET ${updates.join(', ')} WHERE id=$${idx} RETURNING *`,
      values
    );
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
