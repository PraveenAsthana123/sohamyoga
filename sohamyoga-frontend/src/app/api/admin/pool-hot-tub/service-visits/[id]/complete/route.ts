import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { ph_level, chlorine_ppm, alkalinity_ppm, calcium_hardness, labour_hours, labour_rate, parts_cost, notes } = body;
    const total = ((labour_hours || 0) * (labour_rate || 95)) + (parts_cost || 0);

    const visit = await client.query(
      `UPDATE pool_service_visits SET
        status = 'completed',
        ph_level = COALESCE($1, ph_level),
        chlorine_ppm = COALESCE($2, chlorine_ppm),
        alkalinity_ppm = COALESCE($3, alkalinity_ppm),
        calcium_hardness = COALESCE($4, calcium_hardness),
        labour_hours = COALESCE($5, labour_hours),
        labour_rate = COALESCE($6, labour_rate),
        parts_cost = COALESCE($7, parts_cost),
        total_amount = $8,
        notes = COALESCE($9, notes)
       WHERE id = $10 RETURNING *`,
      [ph_level, chlorine_ppm, alkalinity_ppm, calcium_hardness, labour_hours, labour_rate, parts_cost, total, notes, params.id]
    );
    if (!visit.rows.length) return Response.json({ error: 'Visit not found' }, { status: 404 });

    // Update customer last_service_date
    await client.query(
      `UPDATE pool_customers SET last_service_date = $1 WHERE id = $2`,
      [visit.rows[0].visit_date, visit.rows[0].customer_id]
    );

    return Response.json({ visit: visit.rows[0] });
  } finally {
    client.release();
  }
}
