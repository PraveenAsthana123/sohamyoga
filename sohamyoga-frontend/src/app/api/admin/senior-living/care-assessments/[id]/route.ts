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
    const { rows: [row] } = await client.query(
      `SELECT a.*, r.first_name || ' ' || r.last_name AS resident_name FROM sl_care_assessments a JOIN sl_residents r ON r.id = a.resident_id WHERE a.id = $1`,
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
    const fields = ['assessment_type','assessed_by','assessment_date','score','risk_level','recommendations','next_assessment_due'];
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of fields) {
      if (b[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE sl_care_assessments SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
