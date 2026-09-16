import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Verify medication exists and get resident_id
    const { rows: [med] } = await client.query(`SELECT id, resident_id FROM sl_medications WHERE id = $1 AND is_active = true`, [params.id]);
    if (!med) return Response.json({ error: 'Medication not found or inactive' }, { status: 404 });
    const b = await req.json();
    if (!b.administered_by) return Response.json({ error: 'administered_by is required' }, { status: 400 });
    const { rows } = await client.query(`
      INSERT INTO sl_medication_admin (medication_id, resident_id, administered_by, administered_at, dose_given, refused, refused_reason, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [params.id, med.resident_id, b.administered_by, b.administered_at || new Date().toISOString(), b.dose_given, b.refused || false, b.refused_reason, b.notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
