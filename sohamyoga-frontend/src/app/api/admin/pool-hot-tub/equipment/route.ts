import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pool_equipment (
      id SERIAL PRIMARY KEY,
      customer_id INT REFERENCES pool_customers(id) ON DELETE CASCADE,
      equipment_type TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      serial_number TEXT,
      install_date DATE,
      warranty_expiry DATE,
      last_service DATE,
      next_service_due DATE,
      condition TEXT DEFAULT 'good',
      notes TEXT
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const customer_id = searchParams.get('customer_id');

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (customer_id) { conditions.push(`pe.customer_id = $${idx++}`); params.push(customer_id); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await client.query(
      `SELECT pe.*, c.name AS customer_name,
        CASE WHEN warranty_expiry < NOW() THEN 'expired' WHEN warranty_expiry < NOW() + interval '90 days' THEN 'expiring_soon' ELSE 'valid' END AS warranty_status
       FROM pool_equipment pe
       LEFT JOIN pool_customers c ON c.id = pe.customer_id
       ${where} ORDER BY pe.next_service_due ASC NULLS LAST`,
      params
    );
    return Response.json({ equipment: rows.rows });
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
    const { customer_id, equipment_type, brand, model, serial_number, install_date, warranty_expiry, last_service, next_service_due, condition, notes } = body;
    if (!customer_id || !equipment_type) return Response.json({ error: 'customer_id and equipment_type required' }, { status: 400 });
    const row = await client.query(
      `INSERT INTO pool_equipment (customer_id, equipment_type, brand, model, serial_number, install_date, warranty_expiry, last_service, next_service_due, condition, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [customer_id, equipment_type, brand, model, serial_number, install_date || null, warranty_expiry || null, last_service || null, next_service_due || null, condition || 'good', notes]
    );
    return Response.json({ equipment: row.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
