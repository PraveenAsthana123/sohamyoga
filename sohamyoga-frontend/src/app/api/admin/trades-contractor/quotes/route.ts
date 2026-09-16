import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const trade_type = searchParams.get('trade_type');
    const pool = getPool();
    const db = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (status) { values.push(status); conditions.push(`q.status = $${values.length}`); }
      if (trade_type) { values.push(trade_type); conditions.push(`q.trade_type = $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await db.query(
        `SELECT q.*, c.name AS client_name FROM trade_quote q LEFT JOIN trade_client c ON c.id = q.client_id ${where} ORDER BY q.created_at DESC`,
        values
      );
      return Response.json(rows);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const lineItems = body.line_items || [];
    const subtotal = lineItems.reduce((s: number, li: { total?: number }) => s + (li.total || 0), 0);
    const gst = Math.round(subtotal * 0.05 * 100) / 100;
    const total = subtotal + gst;
    const pool = getPool();
    const db = await pool.connect();
    try {
      const { rows } = await db.query(
        `INSERT INTO trade_quote (client_id,job_id,title,trade_type,line_items,subtotal,gst,total,valid_until,terms,status)
         VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [body.client_id,body.job_id||null,body.title,body.trade_type,JSON.stringify(lineItems),subtotal,gst,total,body.valid_until||null,body.terms,body.status||'draft']
      );
      return Response.json(rows[0], { status: 201 });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
