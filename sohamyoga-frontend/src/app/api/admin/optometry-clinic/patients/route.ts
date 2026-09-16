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
    const search = searchParams.get('search') ?? '';
    const recallDue = searchParams.get('recall_due') ?? '';
    let where = 'WHERE 1=1';
    const vals: unknown[] = [];
    if (search) {
      vals.push(`%${search}%`);
      where += ` AND (first_name ILIKE $${vals.length} OR last_name ILIKE $${vals.length} OR phone ILIKE $${vals.length} OR email ILIKE $${vals.length})`;
    }
    if (recallDue === '30') { where += ` AND next_recall_date <= NOW() + INTERVAL '30 days' AND next_recall_date >= NOW()`; }
    else if (recallDue === '60') { where += ` AND next_recall_date <= NOW() + INTERVAL '60 days' AND next_recall_date >= NOW()`; }
    else if (recallDue === '90') { where += ` AND next_recall_date <= NOW() + INTERVAL '90 days' AND next_recall_date >= NOW()`; }
    else if (recallDue === 'overdue') { where += ` AND next_recall_date < NOW()`; }
    const { rows } = await client.query(`SELECT * FROM opt_patient ${where} ORDER BY created_at DESC LIMIT 200`, vals);
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
    const { rows } = await client.query(
      `INSERT INTO opt_patient (first_name, last_name, date_of_birth, health_card_number, phone, email, address, city, province, postal_code, insurance_provider, insurance_id, insurance_group, occupation, family_eye_history, recall_interval_months, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [b.first_name, b.last_name, b.date_of_birth, b.health_card_number ?? null, b.phone, b.email ?? null, b.address ?? null, b.city ?? 'Calgary', b.province ?? 'AB', b.postal_code ?? null, b.insurance_provider ?? null, b.insurance_id ?? null, b.insurance_group ?? null, b.occupation ?? null, b.family_eye_history ?? null, b.recall_interval_months ?? 12, b.notes ?? null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
