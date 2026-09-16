export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const client = await pool.connect();
  try {
    const rows = await client.query(`
      SELECT ha.*, hp.name AS patient_name, hp.phone AS patient_phone
      FROM healthcare_appointment ha
      LEFT JOIN healthcare_patient hp ON hp.id=ha.patient_id
      WHERE ha.appointment_date::date = $1
      ORDER BY ha.appointment_date, ha.provider_name
    `, [date]);

    // Group by provider
    const byProvider: Record<string, unknown[]> = {};
    for (const row of rows.rows) {
      const key = row.provider_name || 'Unassigned';
      if (!byProvider[key]) byProvider[key] = [];
      byProvider[key].push(row);
    }

    return Response.json({ date, schedule: byProvider, total: rows.rows.length });
  } finally {
    client.release();
  }
}
