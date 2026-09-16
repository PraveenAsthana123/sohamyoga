import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `UPDATE pt_appointment SET
         status = 'completed',
         subjective = $1, objective = $2, assessment = $3, plan = $4,
         exercises_prescribed = $5, home_program_updated = $6,
         fee = $7, insurance_claimed = $8, patient_paid = $9, payment_method = $10
       WHERE id = $11 RETURNING *`,
      [b.subjective ?? null, b.objective ?? null, b.assessment ?? null, b.plan ?? null,
       b.exercises_prescribed ?? null, b.home_program_updated ?? false,
       b.fee ?? null, b.insurance_claimed ?? null, b.patient_paid ?? null, b.payment_method ?? null,
       params.id]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally { client.release(); }
}
