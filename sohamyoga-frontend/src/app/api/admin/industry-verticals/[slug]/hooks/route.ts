export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT * FROM vertical_content_hooks WHERE vertical_slug = $1 ORDER BY performance_score DESC, created_at DESC',
      [params.slug],
    );
    return Response.json({ hooks: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.hook_text !== 'string' || !body.hook_text.trim()) {
    return Response.json({ error: 'hook_text is required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO vertical_content_hooks (vertical_slug, hook_type, hook_text, platform, performance_score)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        params.slug,
        body.hook_type ?? 'manual',
        body.hook_text,
        body.platform ?? '',
        Number(body.performance_score) || 3,
      ],
    );
    return Response.json({ hook: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
