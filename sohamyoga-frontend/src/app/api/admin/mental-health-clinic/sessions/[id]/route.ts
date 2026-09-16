import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Full session with clinical notes — therapist access only (enforced by requireAdmin)
    const { rows: [row] } = await client.query(
      `SELECT s.*, c.first_name, c.last_name, c.risk_level, c.presenting_concerns, c.therapy_modality
       FROM mh_session s JOIN mh_client c ON c.id = s.client_id WHERE s.id = $1`,
      [params.id]
    );
    if (!row) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(row);
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const allowed = ['status','session_date','start_time','end_time','session_type','therapist','fee'];
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of allowed) {
      if (b[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE mh_session SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, status, session_date`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
