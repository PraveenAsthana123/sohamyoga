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
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) { conditions.push(`status=$${params.length + 1}`); params.push(status); }
    if (type) { conditions.push(`engagement_type=$${params.length + 1}`); params.push(type); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(`SELECT * FROM cf_client ${where} ORDER BY company_name`, params);
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO cf_client (company_name, industry, contact_name, contact_title, contact_email, contact_phone, city, province, annual_revenue_estimate, employee_count, engagement_type, relationship_manager, source, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [body.company_name, body.industry, body.contact_name, body.contact_title, body.contact_email,
       body.contact_phone, body.city || 'Calgary', body.province || 'AB',
       body.annual_revenue_estimate || null, body.employee_count || null,
       body.engagement_type || 'project', body.relationship_manager, body.source, body.status || 'active']
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
