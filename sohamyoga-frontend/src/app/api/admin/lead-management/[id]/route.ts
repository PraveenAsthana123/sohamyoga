export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM lead_management_leads WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ lead: rows[0] });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b) return Response.json({ error: 'Invalid body' }, { status: 400 });
    const sets: string[] = []; const vals: unknown[] = [];
    const allowed = ['name','email','phone','company','source','status','score','icp_fit','enrichment_data'] as const;
    for (const k of allowed) {
      if (k in b) { vals.push(k === 'enrichment_data' ? JSON.stringify(b[k]) : b[k]); sets.push(`${k}=$${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE lead_management_leads SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ lead: rows[0] });
  } finally { client.release(); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const { rowCount } = await client.query('DELETE FROM lead_management_leads WHERE id=$1', [params.id]);
    if (!rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ok: true });
  } finally { client.release(); }
}
