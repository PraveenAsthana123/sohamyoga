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
    const db = await pool.connect();
    try {
      const { rows } = await db.query(`SELECT q.*, c.name AS client_name FROM trade_quote q LEFT JOIN trade_client c ON c.id = q.client_id WHERE q.id = $1`, [params.id]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
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
        `UPDATE trade_quote SET title=$1,trade_type=$2,line_items=$3::jsonb,subtotal=$4,gst=$5,total=$6,valid_until=$7,terms=$8,status=$9 WHERE id=$10 RETURNING *`,
        [body.title,body.trade_type,JSON.stringify(lineItems),subtotal,gst,total,body.valid_until||null,body.terms,body.status,params.id]
      );
      return Response.json(rows[0]);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
