import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const result = await pool.query('SELECT * FROM calendar_integration ORDER BY created_at DESC LIMIT 500');
    return Response.json({ integrations: result.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { provider, account_email, calendar_name, sync_direction, access_token_env_var } = body;
    const result = await pool.query(
      `INSERT INTO calendar_integration (provider, account_email, calendar_name, sync_direction, access_token_env_var)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [provider, account_email, calendar_name, sync_direction ?? 'both', access_token_env_var]
    );
    return Response.json({ integration: result.rows[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
