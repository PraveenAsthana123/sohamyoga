import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`SELECT * FROM ep_vendor WHERE event_id=$1 ORDER BY vendor_type, created_at`, [params.id]);
      return Response.json({ vendors: rows });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { vendor_type, vendor_name, contact_name, contact_phone, contact_email, quoted_amount, confirmed_amount, deposit_paid = 0, balance_due, contract_signed = false, status = 'contacted', notes } = body;
    if (!vendor_type || !vendor_name) return Response.json({ error: 'vendor_type, vendor_name required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO ep_vendor (event_id,vendor_type,vendor_name,contact_name,contact_phone,contact_email,quoted_amount,confirmed_amount,deposit_paid,balance_due,contract_signed,status,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [params.id, vendor_type, vendor_name, contact_name ?? null, contact_phone ?? null, contact_email ?? null, quoted_amount ?? null, confirmed_amount ?? null, deposit_paid, balance_due ?? null, contract_signed, status, notes ?? null]
      );
      return Response.json({ vendor: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
