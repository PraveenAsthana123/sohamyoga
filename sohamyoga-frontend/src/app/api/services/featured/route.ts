export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


import { pool } from '@/lib/db';

export async function GET(): Promise<Response> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, tenant_id, organization_id, service_code, name, description, status,
              duration_minutes, base_price, currency, tax_code, metadata, created_at, updated_at
       FROM service_master
       WHERE status = 'active'
       ORDER BY name ASC
       LIMIT 6`
    );
    return Response.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
