import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT a.*, c.first_name, c.last_name FROM st_assessment a
       JOIN st_client c ON c.id=a.client_id WHERE a.id=$1`, [parseInt(params.id)]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id);
    const b = await req.json();
    if (b.report_completed) {
      const { rows } = await client.query(
        `UPDATE st_assessment SET report_completed=true, report_date=CURRENT_DATE WHERE id=$1 RETURNING *`, [id]
      );
      return Response.json(rows[0]);
    }
    const allowed = ['clinical_impressions','recommendations','assessment_tools','areas_assessed','standardized_scores'];
    const fields = Object.entries(b).filter(([k]) => allowed.includes(k)).map(([k], i) => `${k}=$${i + 2}`);
    const values = Object.entries(b).filter(([k]) => allowed.includes(k)).map(([, v]) => v);
    if (!fields.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    const { rows } = await client.query(`UPDATE st_assessment SET ${fields.join(',')} WHERE id=$1 RETURNING *`, [id, ...values]);
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
