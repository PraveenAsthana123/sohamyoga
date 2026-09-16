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
    const id = parseInt(params.id);
    const b = await req.json();
    const { rows } = await client.query(
      `UPDATE st_session SET
        status='completed',
        goals_addressed=$2, activities_used=$3,
        client_performance=$4, parent_communication_provided=$5,
        session_notes=$6, homework_assigned=$7,
        fee=$8, funding_source=$9, insurance_claimed=$10, patient_paid=$11
       WHERE id=$1 RETURNING *`,
      [id,
       b.goals_addressed||null, b.activities_used||null,
       b.client_performance||null, b.parent_communication_provided||false,
       b.session_notes||null, b.homework_assigned||null,
       b.fee||null, b.funding_source||'private_pay',
       b.insurance_claimed||null, b.patient_paid||null]
    );
    if (!rows[0]) return Response.json({ error: 'Session not found' }, { status: 404 });
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
