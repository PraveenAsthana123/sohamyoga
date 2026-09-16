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
    const { rows: [med] } = await client.query(
      `SELECT m.*, r.first_name || ' ' || r.last_name AS resident_name FROM sl_medications m JOIN sl_residents r ON r.id = m.resident_id WHERE m.id = $1`,
      [params.id]
    );
    if (!med) return Response.json({ error: 'Not found' }, { status: 404 });
    const { rows: adminHistory } = await client.query(
      `SELECT * FROM sl_medication_admin WHERE medication_id = $1 ORDER BY administered_at DESC LIMIT 20`,
      [params.id]
    );
    return Response.json({ ...med, admin_history: adminHistory });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['drug_name','dosage','route','frequency','times_of_day','prescribing_physician','start_date','end_date','controlled_substance','pharmacy_name','notes','is_active'];
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of fields) {
      if (b[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE sl_medications SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
