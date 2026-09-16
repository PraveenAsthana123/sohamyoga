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
    const { searchParams } = new URL(req.url);
    const patient_id = searchParams.get('patient_id');
    const lab_type = searchParams.get('lab_type');
    const results_received = searchParams.get('results_received');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (patient_id) { conditions.push(`l.patient_id = $${idx++}`); vals.push(patient_id); }
    if (lab_type) { conditions.push(`l.lab_type = $${idx++}`); vals.push(lab_type); }
    if (results_received !== null) { conditions.push(`l.results_received = $${idx++}`); vals.push(results_received === 'true'); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT l.*, p.first_name, p.last_name FROM nd_lab_order l JOIN nd_patient p ON p.id = l.patient_id ${where} ORDER BY l.ordered_date DESC`,
      vals
    );
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const { rows } = await client.query(
      `INSERT INTO nd_lab_order (patient_id, visit_id, ordered_date, naturopath, lab_type, lab_company, tests_ordered, patient_instructions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.patient_id, b.visit_id || null, b.ordered_date || null, b.naturopath || null, b.lab_type || null, b.lab_company || null, b.tests_ordered || null, b.patient_instructions || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
