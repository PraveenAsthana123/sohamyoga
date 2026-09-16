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
  const preferred = searchParams.get('preferred');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (type) { conditions.push(`vendor_type = $${params.length + 1}`); params.push(type); }
      if (preferred === '1') { conditions.push(`is_preferred = true`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`SELECT * FROM id_vendor ${where} ORDER BY is_preferred DESC, quality_rating DESC, vendor_name`, params);
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
        `INSERT INTO id_vendor (vendor_name, vendor_type, contact_name, phone, email, website, trade_discount_pct, payment_terms, lead_time_typical, quality_rating, is_preferred, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [body.vendor_name, body.vendor_type, body.contact_name, body.phone, body.email, body.website,
         body.trade_discount_pct ?? 0, body.payment_terms, body.lead_time_typical,
         body.quality_rating, body.is_preferred ?? false, body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
