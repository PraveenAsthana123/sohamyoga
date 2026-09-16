import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT c.*, (SELECT COUNT(*) FROM sa_job_order j WHERE j.client_company_id=c.id AND j.status='active') AS active_orders_count, (SELECT COUNT(*) FROM sa_submission s JOIN sa_job_order j ON j.id=s.job_order_id WHERE j.client_company_id=c.id) AS total_submissions FROM sa_client_company c WHERE 1=1`;
      const params: any[] = [];
      if (status) { params.push(status); q += ` AND c.status=$${params.length}`; }
      q += ` ORDER BY c.company_name`;
      const { rows } = await client.query(q, params);
      return NextResponse.json(rows);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO sa_client_company (company_name, industry, contact_name, contact_title, contact_email, contact_phone, billing_address, city, province, contract_type, fee_structure, payment_terms, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [body.company_name, body.industry||null, body.contact_name, body.contact_title||null, body.contact_email, body.contact_phone||null, body.billing_address||null, body.city||'Calgary', body.province||'AB', body.contract_type||'contingency', body.fee_structure||null, body.payment_terms||'net_30', body.status||'active', body.notes||null]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
