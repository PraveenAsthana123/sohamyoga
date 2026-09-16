import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS document (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      file_name TEXT,
      file_size_bytes INTEGER,
      mime_type TEXT,
      storage_path TEXT,
      version INTEGER DEFAULT 1,
      status TEXT DEFAULT 'draft',
      tags TEXT[],
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entity_type');
  const status = searchParams.get('status');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (entityType) { conditions.push(`d.entity_type = $${idx++}`); values.push(entityType); }
  if (status) { conditions.push(`d.status = $${idx++}`); values.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT d.*,
       CASE WHEN d.entity_type = 'ad' THEN ac.name ELSE NULL END AS campaign_name,
       CASE WHEN d.entity_type = 'video' THEN uc.title ELSE NULL END AS video_title
     FROM document d
     LEFT JOIN ad_campaign ac ON d.entity_type = 'ad' AND d.entity_id = ac.id
     LEFT JOIN unified_content_item uc ON d.entity_type = 'video' AND d.entity_id = uc.id
     ${where}
     ORDER BY d.created_at DESC`,
    values,
  );

  return Response.json({ documents: result.rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const body = await req.json() as {
    title: string;
    description?: string;
    entity_type?: string;
    entity_id?: number;
    file_name?: string;
    file_size_bytes?: number;
    mime_type?: string;
    storage_path?: string;
    tags?: string[];
    created_by?: number;
  };

  if (!body.title) return Response.json({ error: 'title is required' }, { status: 400 });

  const result = await query(
    `INSERT INTO document (title, description, entity_type, entity_id, file_name, file_size_bytes, mime_type, storage_path, tags, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [body.title, body.description ?? null, body.entity_type ?? null, body.entity_id ?? null,
     body.file_name ?? null, body.file_size_bytes ?? null, body.mime_type ?? null,
     body.storage_path ?? null, body.tags ?? null, body.created_by ?? null],
  );

  return Response.json({ document: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const body = await req.json() as {
    id: number;
    status?: string;
    tags?: string[];
    version?: number;
    description?: string;
  };

  if (!body.id) return Response.json({ error: 'id is required' }, { status: 400 });

  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  if (body.status !== undefined) { sets.push(`status = $${idx++}`); values.push(body.status); }
  if (body.tags !== undefined) { sets.push(`tags = $${idx++}`); values.push(body.tags); }
  if (body.version !== undefined) { sets.push(`version = $${idx++}`); values.push(body.version); }
  if (body.description !== undefined) { sets.push(`description = $${idx++}`); values.push(body.description); }

  values.push(body.id);

  const result = await query(
    `UPDATE document SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );

  if (!result.rows.length) return Response.json({ error: 'Document not found' }, { status: 404 });
  return Response.json({ document: result.rows[0] });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  await ensureTable();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  const result = await query(
    `UPDATE document SET status = 'archived', updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id],
  );

  if (!result.rows.length) return Response.json({ error: 'Document not found' }, { status: 404 });
  return Response.json({ success: true });
}
