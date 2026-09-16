import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const truck_id = searchParams.get('truck_id');
  const event_id = searchParams.get('event_id');
  const category = searchParams.get('category');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (truck_id) { conditions.push(`ex.truck_id = $${idx++}`); values.push(truck_id); }
    if (event_id) { conditions.push(`ex.event_id = $${idx++}`); values.push(event_id); }
    if (category) { conditions.push(`ex.category = $${idx++}`); values.push(category); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT ex.*, t.truck_name, ev.event_name FROM ft_expense ex
       LEFT JOIN ft_truck t ON t.id = ex.truck_id
       LEFT JOIN ft_event ev ON ev.id = ex.event_id
       ${where}
       ORDER BY ex.expense_date DESC`,
      values
    );
    return NextResponse.json({ expenses: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const { truck_id, event_id, expense_date, category, description, amount, vendor, receipt_url } = body;

  if (!truck_id || !category || !description || !amount) {
    return NextResponse.json({ error: 'truck_id, category, description, amount required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ft_expense (truck_id, event_id, expense_date, category, description, amount, vendor, receipt_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [truck_id, event_id || null, expense_date, category, description, amount, vendor, receipt_url]
    );
    return NextResponse.json({ expense: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
