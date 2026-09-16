import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `UPDATE photo_shoot SET status='delivered', gallery_url=COALESCE($1,gallery_url), num_edited_photos=COALESCE($2,num_edited_photos) WHERE id=$3 RETURNING *`,
      [b.gallery_url, b.num_edited_photos, params.id]
    );
    if (!row.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}
