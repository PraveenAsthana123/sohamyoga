import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Get appointment + client info
    const { rows: appts } = await client.query(
      `SELECT a.*, c.id_verified, c.bloodborne_pathogen_consent,
        DATE_PART('year', AGE(c.date_of_birth)) as client_age
       FROM ts_appointment a
       LEFT JOIN ts_client c ON c.id = a.client_id
       WHERE a.id = $1`, [params.id]
    );
    if (!appts.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const appt = appts[0];

    // Verify id_verified
    if (!appt.id_verified) {
      return NextResponse.json({ error: 'Cannot check in: Client ID not verified' }, { status: 400 });
    }

    // Verify age 18+
    if (Number(appt.client_age) < 18) {
      return NextResponse.json({ error: 'Cannot check in: Client is under 18 years old' }, { status: 400 });
    }

    // Verify consent
    if (!appt.bloodborne_pathogen_consent) {
      return NextResponse.json({ error: 'Cannot check in: Bloodborne pathogen consent not on file' }, { status: 400 });
    }

    const { rows } = await client.query(
      `UPDATE ts_appointment SET status = 'in_progress' WHERE id = $1 AND status IN ('booked','confirmed') RETURNING *`,
      [params.id]
    );
    if (!rows.length) {
      return NextResponse.json({ error: 'Appointment cannot be checked in (may not be in booked/confirmed state)' }, { status: 400 });
    }

    return NextResponse.json({ appointment: rows[0], checked_in_at: new Date().toISOString() });
  } finally {
    client.release();
  }
}
