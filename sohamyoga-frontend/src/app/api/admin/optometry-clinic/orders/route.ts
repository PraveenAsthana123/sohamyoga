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
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? '';
    let where = 'WHERE 1=1';
    const vals: unknown[] = [];
    if (status) { vals.push(status); where += ` AND o.status = $${vals.length}`; }
    const { rows } = await client.query(
      `SELECT o.*, p.first_name, p.last_name, p.phone
       FROM opt_order o JOIN opt_patient p ON p.id = o.patient_id
       ${where} ORDER BY o.created_at DESC LIMIT 200`,
      vals
    );
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const balance = (b.total_amount ?? 0) - (b.deposit_paid ?? 0) - (b.insurance_claimed ?? 0);
    const { rows } = await client.query(
      `INSERT INTO opt_order (patient_id, exam_id, order_type, frame_sku, lens_type, lens_coating, contact_brand, contact_quantity, total_amount, deposit_paid, insurance_claimed, patient_balance, status, lab_reference, expected_ready_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [b.patient_id, b.exam_id ?? null, b.order_type, b.frame_sku ?? null, b.lens_type ?? null, b.lens_coating ?? null, b.contact_brand ?? null, b.contact_quantity ?? null, b.total_amount ?? null, b.deposit_paid ?? 0, b.insurance_claimed ?? 0, balance, b.status ?? 'ordered', b.lab_reference ?? null, b.expected_ready_date ?? null, b.notes ?? null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
