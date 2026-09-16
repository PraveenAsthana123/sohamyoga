import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');

  let query = 'SELECT * FROM broadcast WHERE 1=1';
  const params: (string | number)[] = [];
  let idx = 1;

  if (status) { query += ` AND status = $${idx++}`; params.push(status); }
  if (type) { query += ` AND broadcast_type = $${idx++}`; params.push(type); }
  query += ' ORDER BY created_at DESC LIMIT 100';

  try {
    const result = await pool.query(query, params);
    return NextResponse.json({ broadcasts: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, subject, body: msgBody, broadcast_type, target_audience, scheduled_at } = body;
    const status = scheduled_at ? 'scheduled' : 'draft';

    const result = await pool.query(
      `INSERT INTO broadcast (name, subject, body, broadcast_type, target_audience, status, scheduled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, subject, msgBody, broadcast_type, target_audience, status, scheduled_at || null]
    );
    return NextResponse.json({ broadcast: result.rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
