import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT v.*, p.name AS patient_name, p.species, p.breed,
          o.first_name AS owner_first, o.last_name AS owner_last, o.phone AS owner_phone, o.email AS owner_email
        FROM vet_vaccination v
        LEFT JOIN vet_patient p ON p.id=v.patient_id AND p.status='active'
        LEFT JOIN vet_owner o ON o.id=p.owner_id
        WHERE v.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
          AND p.id IS NOT NULL
        ORDER BY v.next_due_date
      `);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
