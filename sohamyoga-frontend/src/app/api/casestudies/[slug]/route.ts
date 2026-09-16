export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
): Promise<Response> {
  const { slug } = params;
  const client = await pool.connect();
  try {
    let rows: Record<string, unknown>[];
    if (UUID_RE.test(slug)) {
      ({ rows } = await client.query(
        `SELECT * FROM case_study WHERE id = $1`,
        [slug]
      ));
    } else {
      const titleLike = slug.replace(/-/g, ' ');
      ({ rows } = await client.query(
        `SELECT * FROM case_study WHERE title ILIKE $1 AND status = 'published' LIMIT 1`,
        [`%${titleLike}%`]
      ));
    }

    if (!rows.length) {
      return Response.json({ error: 'Case study not found' }, { status: 404 });
    }
    return Response.json(rows[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
