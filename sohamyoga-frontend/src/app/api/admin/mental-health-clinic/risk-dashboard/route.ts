import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT c.id, c.first_name, c.last_name, c.risk_level, c.therapist,
              c.safety_plan_in_place, c.emergency_contact_name, c.emergency_contact_phone,
              MAX(s.session_date) AS last_session_date,
              MIN(s2.session_date) AS next_scheduled
       FROM mh_client c
       LEFT JOIN mh_session s ON s.client_id = c.id AND s.status = 'completed'
       LEFT JOIN mh_session s2 ON s2.client_id = c.id AND s2.status = 'scheduled' AND s2.session_date >= CURRENT_DATE
       WHERE c.risk_level IN ('moderate','high','crisis') AND c.status = 'active'
       GROUP BY c.id
       ORDER BY CASE c.risk_level WHEN 'crisis' THEN 1 WHEN 'high' THEN 2 WHEN 'moderate' THEN 3 END, c.last_name ASC`
    );
    return Response.json(rows);
  } finally { client.release(); }
}
