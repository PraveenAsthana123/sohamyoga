import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (type) { conditions.push(`client_type = $${params.length + 1}`); params.push(type); }
      if (status) { conditions.push(`status = $${params.length + 1}`); params.push(status); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`SELECT * FROM cpm_client ${where} ORDER BY company_name`, params);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO cpm_client (company_name, contact_name, contact_email, contact_phone, billing_address, city, province, client_type, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [body.company_name, body.contact_name, body.contact_email, body.contact_phone,
         body.billing_address, body.city ?? 'Calgary', body.province ?? 'AB',
         body.client_type ?? 'commercial', body.status ?? 'active', body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
