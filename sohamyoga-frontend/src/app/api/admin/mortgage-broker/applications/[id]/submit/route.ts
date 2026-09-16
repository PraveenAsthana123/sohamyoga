import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b || !b.lender) return Response.json({ error: 'lender required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Upsert submission record
    const result = await client.query(`
      INSERT INTO mortgage_lender_submission
        (application_id, lender, submitted_at, rate_offered, conditions, status, notes)
      VALUES ($1, $2, NOW(), $3, $4, 'submitted', $5)
      ON CONFLICT (application_id, lender) DO UPDATE SET
        submitted_at = NOW(),
        rate_offered = EXCLUDED.rate_offered,
        conditions = EXCLUDED.conditions,
        status = 'submitted',
        notes = EXCLUDED.notes
      RETURNING *
    `, [
      Number(id), b.lender,
      b.rate_offered ? Number(b.rate_offered) : null,
      b.conditions || null,
      b.notes || null,
    ]);

    // Update application status to submitted if still draft
    await client.query(`
      UPDATE mortgage_application
      SET status = 'submitted'
      WHERE id = $1 AND status = 'draft'
    `, [id]);

    return Response.json({ submission: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM mortgage_lender_submission WHERE application_id = $1 ORDER BY submitted_at DESC
    `, [id]);
    return Response.json({ submissions: result.rows });
  } finally {
    client.release();
  }
}
