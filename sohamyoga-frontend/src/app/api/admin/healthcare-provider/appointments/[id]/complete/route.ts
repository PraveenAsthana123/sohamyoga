export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { treatment_notes, fee, insurance_covered, patient_paid, follow_up_required, follow_up_date } = body;

    const r = await client.query(`
      UPDATE healthcare_appointment
      SET status='completed', treatment_notes=$1, fee=$2, insurance_covered=$3, patient_paid=$4,
          follow_up_required=$5, follow_up_date=$6
      WHERE id=$7 RETURNING *
    `, [treatment_notes, fee, insurance_covered, patient_paid, follow_up_required||false, follow_up_date||null, params.id]);

    if (!r.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ appointment: r.rows[0] });
  } finally {
    client.release();
  }
}
