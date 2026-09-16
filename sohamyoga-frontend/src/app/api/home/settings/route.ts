export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS site_setting (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(): Promise<Response> {
  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const { rows } = await client.query(`SELECT key, value FROM site_setting ORDER BY key`);
    const result: Record<string, string> = {};
    for (const row of rows as { key: string; value: string }[]) {
      result[row.key] = row.value;
    }
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const body = await req.json() as { key: string; value: string };
    const { key, value } = body;
    if (!key || typeof key !== 'string') {
      return Response.json({ error: 'key is required' }, { status: 400 });
    }

    await client.query(
      `INSERT INTO site_setting (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value ?? null]
    );
    return Response.json({ success: true, key, value });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
