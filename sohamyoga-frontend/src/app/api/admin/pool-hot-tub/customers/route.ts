import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pool_customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      pool_type TEXT DEFAULT 'inground',
      pool_size_gallons INT,
      hot_tub_brand TEXT,
      service_plan TEXT DEFAULT 'standard',
      contract_start DATE,
      contract_end DATE,
      notes TEXT,
      is_active BOOLEAN DEFAULT true,
      last_service_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const service_type = searchParams.get('service_type');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (service_type) { conditions.push(`service_plan = $${idx++}`); params.push(service_type); }
    if (status === 'active') { conditions.push(`is_active = true`); }
    else if (status === 'inactive') { conditions.push(`is_active = false`); }
    if (search) { conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx} OR address ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await client.query(
      `SELECT *, CASE WHEN contract_end < NOW() THEN 'expired' WHEN contract_end < NOW() + interval '30 days' THEN 'expiring_soon' ELSE 'active' END AS contract_status FROM pool_customers ${where} ORDER BY created_at DESC`,
      params
    );
    return Response.json({ customers: rows.rows });
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
    const { name, email, phone, address, pool_type, pool_size_gallons, hot_tub_brand, service_plan, contract_start, contract_end, notes } = body;
    if (!name) return Response.json({ error: 'name required' }, { status: 400 });

    const row = await client.query(
      `INSERT INTO pool_customers (name, email, phone, address, pool_type, pool_size_gallons, hot_tub_brand, service_plan, contract_start, contract_end, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name, email, phone, address, pool_type, pool_size_gallons, hot_tub_brand, service_plan, contract_start || null, contract_end || null, notes]
    );
    return Response.json({ customer: row.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
