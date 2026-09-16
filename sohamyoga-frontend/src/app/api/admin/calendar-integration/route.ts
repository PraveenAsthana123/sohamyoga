import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM calendar_integration ORDER BY created_at DESC');
    return NextResponse.json({ integrations: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, account_email, calendar_name, sync_direction, access_token_env_var } = body;
    const result = await pool.query(
      `INSERT INTO calendar_integration (provider, account_email, calendar_name, sync_direction, access_token_env_var)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [provider, account_email, calendar_name, sync_direction ?? 'both', access_token_env_var]
    );
    return NextResponse.json({ integration: result.rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
