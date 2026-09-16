import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const loyalty_tier = searchParams.get('loyalty_tier');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT * FROM sr_customer WHERE 1=1`;
      const params: any[] = [];
      if (loyalty_tier) { params.push(loyalty_tier); q += ` AND loyalty_tier=$${params.length}`; }
      q += ` ORDER BY total_spent DESC`;
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
        `INSERT INTO sr_customer (first_name, last_name, email, phone, birthday, preferred_categories, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [body.first_name, body.last_name, body.email||null, body.phone||null, body.birthday||null, body.preferred_categories||[], body.notes||null]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
