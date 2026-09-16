import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT p.*,
             o.first_name AS owner_first, o.last_name AS owner_last,
             o.phone AS owner_phone, o.email AS owner_email,
             LEAST(
               CASE WHEN p.rabies_expiry IS NOT NULL THEN p.rabies_expiry END,
               CASE WHEN p.bordetella_expiry IS NOT NULL THEN p.bordetella_expiry END,
               CASE WHEN p.distemper_expiry IS NOT NULL THEN p.distemper_expiry END
             ) AS soonest_expiry,
             CASE WHEN p.rabies_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN true ELSE false END AS rabies_due,
             CASE WHEN p.bordetella_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN true ELSE false END AS bordetella_due,
             CASE WHEN p.distemper_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN true ELSE false END AS distemper_due
      FROM pg_pet p
      LEFT JOIN pg_owner o ON p.owner_id = o.id
      WHERE (p.rabies_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
         OR (p.bordetella_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
         OR (p.distemper_expiry BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')
      ORDER BY soonest_expiry ASC
    `);
    return Response.json({ pets_due: result.rows });
  } finally {
    client.release();
  }
}
