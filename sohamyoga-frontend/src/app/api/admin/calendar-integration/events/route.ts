import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = 'SELECT * FROM calendar_event_ext WHERE 1=1';
  const params: string[] = [];
  let idx = 1;

  if (from) { query += ` AND start_at >= $${idx++}`; params.push(from); }
  if (to) { query += ` AND end_at <= $${idx++}`; params.push(to); }
  query += ' ORDER BY start_at ASC LIMIT 200';

  try {
    const result = await pool.query(query, params);
    return NextResponse.json({ events: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, start_at, end_at, all_day, location, event_type, provider } = body;
    const result = await pool.query(
      `INSERT INTO calendar_event_ext (title, description, start_at, end_at, all_day, location, event_type, provider, is_local)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING *`,
      [title, description, start_at, end_at, all_day ?? false, location, event_type ?? 'meeting', provider ?? 'local']
    );
    return NextResponse.json({ event: result.rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
