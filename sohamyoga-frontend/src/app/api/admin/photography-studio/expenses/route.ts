import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const shootId = req.nextUrl.searchParams.get('shoot_id');
    const where = shootId ? `WHERE e.shoot_id = $1` : '';
    const values = shootId ? [shootId] : [];
    const rows = await client.query(
      `SELECT e.*, s.title AS shoot_title FROM photo_expense e LEFT JOIN photo_shoot s ON s.id = e.shoot_id ${where} ORDER BY e.created_at DESC LIMIT 200`,
      values
    );
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `INSERT INTO photo_expense (shoot_id,category,description,amount,receipt_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [b.shoot_id, b.category, b.description, b.amount, b.receipt_url]
    );
    return Response.json(row.rows[0], { status: 201 });
  } finally { client.release(); }
}
