export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
): Promise<Response> {
  const { slug } = params;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, tenant_id, organization_id, service_code, name, description, status,
              duration_minutes, base_price, currency, tax_code, metadata, created_at, updated_at
       FROM service_master
       WHERE service_code = $1`,
      [slug]
    );
    if (!rows.length) {
      return Response.json({ error: 'Service not found' }, { status: 404 });
    }
    return Response.json(rows[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
