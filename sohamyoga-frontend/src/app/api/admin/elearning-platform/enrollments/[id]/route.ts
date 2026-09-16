import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { action } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    let result;
    if (action === 'complete') {
      result = await client.query(
        `UPDATE el_enrollment SET progress_pct = 100, completed_at = NOW() WHERE id = $1 RETURNING *`,
        [params.id]
      );
    } else if (action === 'issue_certificate') {
      result = await client.query(
        `UPDATE el_enrollment SET certificate_issued = true WHERE id = $1 AND completed_at IS NOT NULL RETURNING *`,
        [params.id]
      );
      if (!result.rows.length) {
        // Check if enrollment exists but not completed
        const exists = await client.query(`SELECT id FROM el_enrollment WHERE id = $1`, [params.id]);
        if (exists.rows.length) return Response.json({ error: 'Course must be completed before issuing certificate' }, { status: 400 });
        return Response.json({ error: 'Enrollment not found' }, { status: 404 });
      }
    } else if (action === 'refund') {
      result = await client.query(
        `UPDATE el_enrollment SET refunded = true, refunded_at = NOW() WHERE id = $1 RETURNING *`,
        [params.id]
      );
    } else {
      const allowed = ['progress_pct'];
      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (key in body) { updates.push(`${key} = $${idx++}`); values.push(body[key]); }
      }
      if (!updates.length) return Response.json({ error: 'No valid action or fields' }, { status: 400 });
      values.push(params.id);
      result = await client.query(
        `UPDATE el_enrollment SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
    }
    if (!result.rows.length) return Response.json({ error: 'Enrollment not found' }, { status: 404 });
    return Response.json({ enrollment: result.rows[0] });
  } finally {
    client.release();
  }
}
