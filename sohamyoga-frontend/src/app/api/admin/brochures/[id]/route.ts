import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM brochures WHERE id = $1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Brochure not found.' }, { status: 404 });
    return Response.json({ brochure: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    title?: string; description?: string; category?: string;
    file_url?: string | null; thumbnail_url?: string | null;
    version?: string; status?: string; tags?: string[];
    increment_download?: boolean;
  } | null;

  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    let query: string;
    let values: unknown[];

    if (body.increment_download) {
      const res = await client.query(
        `UPDATE brochures SET download_count = download_count + 1, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [params.id],
      );
      if (!res.rowCount) return Response.json({ error: 'Brochure not found.' }, { status: 404 });
      return Response.json({ brochure: res.rows[0] });
    }

    query = `
      UPDATE brochures SET
        title          = COALESCE($2, title),
        description    = COALESCE($3, description),
        category       = COALESCE($4, category),
        file_url       = COALESCE($5, file_url),
        thumbnail_url  = COALESCE($6, thumbnail_url),
        version        = COALESCE($7, version),
        status         = COALESCE($8, status),
        tags           = COALESCE($9::TEXT[], tags),
        updated_at     = NOW()
      WHERE id = $1
      RETURNING *
    `;
    values = [
      params.id,
      body.title ?? null,
      body.description ?? null,
      body.category ?? null,
      body.file_url ?? null,
      body.thumbnail_url ?? null,
      body.version ?? null,
      body.status ?? null,
      body.tags && body.tags.length ? body.tags : null,
    ];

    const { rows, rowCount } = await client.query(query, values);
    if (!rowCount) return Response.json({ error: 'Brochure not found.' }, { status: 404 });
    return Response.json({ brochure: rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(`DELETE FROM brochures WHERE id = $1`, [params.id]);
    if (!rowCount) return Response.json({ error: 'Brochure not found.' }, { status: 404 });
    return Response.json({ success: true });
  } finally {
    client.release();
  }
}
