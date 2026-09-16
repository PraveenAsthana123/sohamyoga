import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 });
  const pool = getPool();
  const allowed = [
    'event_name', 'company_name', 'contact_name', 'contact_email', 'contact_phone',
    'sponsorship_tier', 'sponsorship_amount_cad', 'benefits_json',
    'status', 'pitch_date', 'decision_date', 'notes', 'logo_url',
  ];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key}=$${idx++}`);
      vals.push(key === 'benefits_json' ? JSON.stringify(body[key]) : body[key]);
    }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
  vals.push(params.id);
  const { rows, rowCount } = await pool.query(
    `UPDATE event_sponsors SET ${sets.join(',')} WHERE id=$${idx} RETURNING *`,
    vals,
  );
  if (!rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ sponsor: rows[0] });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const { rowCount } = await pool.query(`DELETE FROM event_sponsors WHERE id=$1`, [params.id]);
  if (!rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ok: true });
}
