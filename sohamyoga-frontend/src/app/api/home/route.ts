export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


import { pool } from '@/lib/db';

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
    const { rows } = await client.query(
      `SELECT key, value FROM site_setting`
    );
    const settings: Record<string, string> = {};
    for (const row of rows as { key: string; value: string }[]) {
      settings[row.key] = row.value;
    }
    return Response.json({
      title: settings['site_title'] ?? 'SohamYoga',
      tagline: settings['site_tagline'] ?? 'Transform your practice',
      settings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
