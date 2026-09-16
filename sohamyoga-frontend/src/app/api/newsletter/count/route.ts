export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


import { pool } from '@/lib/db';

export async function GET(): Promise<Response> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM email_subscriber WHERE status = 'active'`
    );
    return Response.json({ count: parseInt(rows[0].count, 10) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
