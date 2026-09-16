export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


import { pool } from '@/lib/db';

interface ServiceRow {
  id: string;
  tenant_id: string;
  organization_id: string;
  service_code: string;
  name: string;
  description: string;
  status: string;
  duration_minutes: number;
  base_price: string;
  currency: string;
  tax_code: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function GET(): Promise<Response> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<ServiceRow>(
      `SELECT id, tenant_id, organization_id, service_code, name, description, status,
              duration_minutes, base_price, currency, tax_code, metadata, created_at, updated_at
       FROM service_master
       WHERE status = 'active'
       ORDER BY name ASC`
    );
    return Response.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
