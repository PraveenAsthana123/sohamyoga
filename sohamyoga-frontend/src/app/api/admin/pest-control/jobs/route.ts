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
    const customer_id = searchParams.get('customer_id');
    const status = searchParams.get('status');
    const technician = searchParams.get('technician');
    const date = searchParams.get('date');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (customer_id) { conditions.push(`j.customer_id = $${idx++}`); vals.push(customer_id); }
    if (status) { conditions.push(`j.status = $${idx++}`); vals.push(status); }
    if (technician) { conditions.push(`j.technician_id = $${idx++}`); vals.push(technician); }
    if (date) { conditions.push(`j.scheduled_date = $${idx++}`); vals.push(date); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT j.*, c.name AS customer_name, c.address AS customer_address, c.pet_on_property,
              t.name AS technician_name, t.license_class
       FROM pc_jobs j
       LEFT JOIN pc_customers c ON c.id = j.customer_id
       LEFT JOIN pc_technicians t ON t.id = j.technician_id
       ${where}
       ORDER BY j.scheduled_date DESC, j.created_at DESC`,
      vals
    );
    return Response.json({ jobs: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b?.customer_id) return Response.json({ error: 'customer_id is required.' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO pc_jobs (customer_id, job_type, pest_type, status, scheduled_date, technician_id, infestation_level, products_used, treatment_method, follow_up_required, follow_up_date, labour_hours, total_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [b.customer_id, b.job_type ?? null, b.pest_type ?? null, b.status ?? 'scheduled', b.scheduled_date ?? null, b.technician_id ?? null, b.infestation_level ?? null, b.products_used ? JSON.stringify(b.products_used) : null, b.treatment_method ?? null, b.follow_up_required ?? false, b.follow_up_date ?? null, b.labour_hours ?? null, b.total_amount ?? null, b.notes ?? null]
    );
    return Response.json({ job: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
