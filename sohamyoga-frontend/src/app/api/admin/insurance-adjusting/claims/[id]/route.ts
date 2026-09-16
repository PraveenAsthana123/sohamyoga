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
    const [claimRow, payments, inspections] = await Promise.all([
      client.query(`SELECT c.*, a.name AS adjuster_name FROM adj_claims c LEFT JOIN adj_adjusters a ON a.id=c.adjuster_id WHERE c.id=$1`, [params.id]),
      client.query(`SELECT * FROM adj_payments WHERE claim_id=$1 ORDER BY payment_date DESC`, [params.id]),
      client.query(`SELECT i.*, a.name AS adjuster_name FROM adj_inspections i LEFT JOIN adj_adjusters a ON a.id=i.adjuster_id WHERE i.claim_id=$1 ORDER BY i.scheduled_date`, [params.id]),
    ]);
    if (!claimRow.rows.length) return Response.json({ error: 'Claim not found.' }, { status: 404 });
    return Response.json({ claim: claimRow.rows[0], payments: payments.rows, inspections: inspections.rows });
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
    const { rows } = await client.query(
      `UPDATE adj_claims SET
        insurer_name=COALESCE($2,insurer_name),
        insurer_file_number=COALESCE($3,insurer_file_number),
        insured_name=COALESCE($4,insured_name),
        insured_phone=COALESCE($5,insured_phone),
        insured_email=COALESCE($6,insured_email),
        loss_address=COALESCE($7,loss_address),
        loss_date=COALESCE($8,loss_date),
        claim_type=COALESCE($9,claim_type),
        cause_of_loss=COALESCE($10,cause_of_loss),
        policy_number=COALESCE($11,policy_number),
        deductible_amount=COALESCE($12,deductible_amount),
        coverage_limit=COALESCE($13,coverage_limit),
        reserve_amount=COALESCE($14,reserve_amount),
        status=COALESCE($15,status),
        priority=COALESCE($16,priority),
        adjuster_id=COALESCE($17,adjuster_id),
        insurer_contact_name=COALESCE($18,insurer_contact_name),
        insurer_contact_email=COALESCE($19,insurer_contact_email),
        notes=COALESCE($20,notes)
       WHERE id=$1 RETURNING *`,
      [params.id, body.insurer_name, body.insurer_file_number, body.insured_name, body.insured_phone, body.insured_email, body.loss_address, body.loss_date, body.claim_type, body.cause_of_loss, body.policy_number, body.deductible_amount, body.coverage_limit, body.reserve_amount, body.status, body.priority, body.adjuster_id, body.insurer_contact_name, body.insurer_contact_email, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Claim not found.' }, { status: 404 });
    return Response.json({ claim: rows[0] });
  } finally {
    client.release();
  }
}
