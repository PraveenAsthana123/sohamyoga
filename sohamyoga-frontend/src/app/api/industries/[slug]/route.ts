export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
): Promise<Response> {
  const { slug } = params;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, name, slug, description, icon, is_active, sort_order, created_at
       FROM industry_solution
       WHERE slug = $1 AND is_active = true`,
      [slug]
    );
    if (!rows.length) {
      return Response.json({ error: 'Industry not found' }, { status: 404 });
    }
    return Response.json(rows[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
