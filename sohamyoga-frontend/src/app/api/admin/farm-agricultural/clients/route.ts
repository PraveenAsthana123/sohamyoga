import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const { searchParams } = new URL(req.url);
    const operation_type = searchParams.get('operation_type');
    const province = searchParams.get('province');
    const search = searchParams.get('search');
    const conditions: string[] = ['is_active=true'];
    const vals: unknown[] = [];
    if (operation_type) { conditions.push(`operation_type=$${vals.length + 1}`); vals.push(operation_type); }
    if (province) { conditions.push(`province=$${vals.length + 1}`); vals.push(province); }
    if (search) { conditions.push(`(farm_name ILIKE $${vals.length + 1} OR operator_name ILIKE $${vals.length + 1})`); vals.push(`%${search}%`); }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`SELECT * FROM ag_clients ${where} ORDER BY farm_name`, vals);
      return Response.json({ clients: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag clients GET error:', err);
    return Response.json({ error: 'Failed to fetch clients.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const body = await req.json().catch(() => null);
    if (!body?.farm_name || !body?.operator_name) return Response.json({ error: 'farm_name and operator_name are required.' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO ag_clients (farm_name, operator_name, email, phone, address, municipality, province, quarter_sections, total_acres, operation_type, primary_crops, livestock_types, afsc_policy_number, carbon_credit_enrolled, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [body.farm_name, body.operator_name, body.email, body.phone, body.address, body.municipality, body.province ?? 'AB', body.quarter_sections, body.total_acres, body.operation_type ?? 'grain', body.primary_crops, body.livestock_types, body.afsc_policy_number, body.carbon_credit_enrolled ?? false, body.notes]
      );
      return Response.json({ client: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag clients POST error:', err);
    return Response.json({ error: 'Failed to create client.' }, { status: 500 });
  }
}
