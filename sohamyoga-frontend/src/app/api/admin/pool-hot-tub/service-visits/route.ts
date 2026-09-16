import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pool_service_visits (
      id SERIAL PRIMARY KEY,
      customer_id INT REFERENCES pool_customers(id) ON DELETE CASCADE,
      technician_name TEXT,
      visit_date DATE NOT NULL,
      visit_type TEXT DEFAULT 'maintenance',
      status TEXT DEFAULT 'scheduled',
      ph_level NUMERIC(4,2),
      chlorine_ppm NUMERIC(5,2),
      alkalinity_ppm INT,
      calcium_hardness INT,
      notes TEXT,
      labour_hours NUMERIC(5,2) DEFAULT 0,
      labour_rate NUMERIC(8,2) DEFAULT 95,
      parts_cost NUMERIC(10,2) DEFAULT 0,
      total_amount NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const customer_id = searchParams.get('customer_id');
  const date = searchParams.get('date');
  const status = searchParams.get('status');
  const technician = searchParams.get('technician');

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (customer_id) { conditions.push(`sv.customer_id = $${idx++}`); params.push(customer_id); }
    if (date) { conditions.push(`sv.visit_date = $${idx++}`); params.push(date); }
    if (status) { conditions.push(`sv.status = $${idx++}`); params.push(status); }
    if (technician) { conditions.push(`sv.technician_name ILIKE $${idx++}`); params.push(`%${technician}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await client.query(
      `SELECT sv.*, c.name AS customer_name, c.address AS customer_address, c.pool_type
       FROM pool_service_visits sv
       LEFT JOIN pool_customers c ON c.id = sv.customer_id
       ${where} ORDER BY sv.visit_date DESC, sv.id DESC`,
      params
    );
    return Response.json({ visits: rows.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const { customer_id, technician_name, visit_date, visit_type, status, ph_level, chlorine_ppm, alkalinity_ppm, calcium_hardness, notes, labour_hours, labour_rate, parts_cost } = body;
    if (!customer_id || !visit_date) return Response.json({ error: 'customer_id and visit_date required' }, { status: 400 });
    const total = ((labour_hours || 0) * (labour_rate || 95)) + (parts_cost || 0);
    const row = await client.query(
      `INSERT INTO pool_service_visits (customer_id, technician_name, visit_date, visit_type, status, ph_level, chlorine_ppm, alkalinity_ppm, calcium_hardness, notes, labour_hours, labour_rate, parts_cost, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [customer_id, technician_name, visit_date, visit_type || 'maintenance', status || 'scheduled', ph_level, chlorine_ppm, alkalinity_ppm, calcium_hardness, notes, labour_hours || 0, labour_rate || 95, parts_cost || 0, total]
    );
    return Response.json({ visit: row.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
