import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT i.*, a.name AS adjuster_name, c.claim_number, c.insured_name, c.insurer_name
       FROM adj_inspections i
       LEFT JOIN adj_adjusters a ON a.id=i.adjuster_id
       LEFT JOIN adj_claims c ON c.id=i.claim_id
       WHERE i.id=$1`,
      [params.id]
    );
    if (!rows.length) return Response.json({ error: 'Inspection not found.' }, { status: 404 });
    return Response.json({ inspection: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid body.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const submitReport = body.submit_report === true;
    const { rows } = await client.query(
      `UPDATE adj_inspections SET
        inspection_type=COALESCE($2,inspection_type),
        scheduled_date=COALESCE($3,scheduled_date),
        completed_date=COALESCE($4,completed_date),
        adjuster_id=COALESCE($5,adjuster_id),
        inspection_address=COALESCE($6,inspection_address),
        findings_summary=COALESCE($7,findings_summary),
        estimated_repair_cost=COALESCE($8,estimated_repair_cost),
        depreciation_applied=COALESCE($9,depreciation_applied),
        actual_cash_value=COALESCE($10,actual_cash_value),
        replacement_cost_value=COALESCE($11,replacement_cost_value),
        contractor_estimates=COALESCE($12,contractor_estimates),
        photos_count=COALESCE($13,photos_count),
        report_submitted_at=CASE WHEN $14 THEN NOW() ELSE report_submitted_at END
       WHERE id=$1 RETURNING *`,
      [params.id, body.inspection_type, body.scheduled_date, body.completed_date, body.adjuster_id, body.inspection_address, body.findings_summary, body.estimated_repair_cost, body.depreciation_applied, body.actual_cash_value, body.replacement_cost_value, body.contractor_estimates ? JSON.stringify(body.contractor_estimates) : null, body.photos_count, submitReport]
    );
    if (!rows.length) return Response.json({ error: 'Inspection not found.' }, { status: 404 });
    return Response.json({ inspection: rows[0] });
  } finally {
    client.release();
  }
}
