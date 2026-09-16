import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const vendor_type = searchParams.get('type') ?? '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const where = vendor_type ? `WHERE vendor_type=$1` : '';
    const values = vendor_type ? [vendor_type] : [];
    const r = await client.query(`SELECT * FROM wv_vendor_preferred ${where} ORDER BY vendor_type,vendor_name`, values);
    return Response.json({ vendors: r.rows });
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
    const r = await client.query(
      `INSERT INTO wv_vendor_preferred (vendor_type,vendor_name,contact_name,phone,email,website,commission_pct,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.vendor_type,body.vendor_name,body.contact_name||null,body.phone||null,
       body.email||null,body.website||null,body.commission_pct||0,body.notes||null]
    );
    return Response.json({ vendor: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
