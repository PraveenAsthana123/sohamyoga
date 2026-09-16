export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest, { params }: { params: { id: string; action: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { action, id } = params;
  const allowedActions: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    paid: 'paid',
    submit: 'submitted',
  };

  if (!allowedActions[action]) {
    return Response.json({ error: `Unknown action. Use: ${Object.keys(allowedActions).join(', ')}` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const body = await req.json().catch(() => ({}));
    const newStatus = allowedActions[action];

    const r = await client.query(`
      UPDATE healthcare_claim
      SET status=$1,
          approved_amount=CASE WHEN $1='approved' OR $1='paid' THEN COALESCE($2::numeric, claim_amount) ELSE approved_amount END,
          payment_date=CASE WHEN $1='paid' THEN CURRENT_DATE ELSE payment_date END,
          notes=COALESCE($3, notes)
      WHERE id=$4 RETURNING *
    `, [newStatus, body.approved_amount ?? null, body.notes ?? null, id]);

    if (!r.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ claim: r.rows[0] });
  } finally {
    client.release();
  }
}
