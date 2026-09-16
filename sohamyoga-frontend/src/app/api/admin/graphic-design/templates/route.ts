import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const pool = getPool();

  const templates = category
    ? await pool.query(
        `SELECT * FROM design_templates WHERE category = $1 AND is_approved = true ORDER BY use_count DESC`,
        [category]
      )
    : await pool.query(`SELECT * FROM design_templates WHERE is_approved = true ORDER BY category, use_count DESC`);

  return Response.json({ templates: templates.rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return Response.json({ error: 'name is required.' }, { status: 400 });
  }

  // Handle use_count increment
  if (body.action === 'increment_use' && body.id) {
    const result = await getPool().query(
      `UPDATE design_templates SET use_count = use_count + 1 WHERE id = $1 RETURNING use_count`,
      [body.id]
    );
    if (!result.rowCount) return Response.json({ error: 'Template not found.' }, { status: 404 });
    return Response.json({ ok: true, use_count: result.rows[0].use_count });
  }

  const result = await getPool().query(
    `INSERT INTO design_templates
      (name, category, platform, dimensions, thumbnail_url, canva_url, figma_url, description, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      body.name, body.category || null, body.platform || null, body.dimensions || null,
      body.thumbnail_url || null, body.canva_url || null, body.figma_url || null,
      body.description || null, body.tags || null,
    ]
  );

  return Response.json({ ok: true, template: result.rows[0] }, { status: 201 });
}
