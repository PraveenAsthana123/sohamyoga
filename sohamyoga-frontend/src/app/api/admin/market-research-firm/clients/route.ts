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
    const where = status ? `WHERE status=$1` : '';
    const { rows } = await client.query(`SELECT * FROM mr_client ${where} ORDER BY company_name`, status ? [status] : []);
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
      `INSERT INTO mr_client (company_name, industry, contact_name, contact_email, contact_phone, city, province, research_budget_annual, preferred_methodology, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [body.company_name, body.industry, body.contact_name, body.contact_email, body.contact_phone,
       body.city || 'Calgary', body.province || 'AB', body.research_budget_annual || null,
       body.preferred_methodology || [], body.status || 'active', body.notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
