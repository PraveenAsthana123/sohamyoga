import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';
import { withApiErrorLog } from '../../../lib/api-error-log';

const CATEGORIES = ['market_research', 'digital_marketing', 'ai_automation'];

async function wid() {
  const r = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  return r.rows[0]?.id;
}

async function handleGet(req: NextRequest) {
  const w = await wid();
  if (!w) return Response.json({ error: 'Workspace missing.' }, { status: 503 });
  const isAdmin = !(await requireAdmin(req));
  const category = req.nextUrl.searchParams.get('category');

  const conditions = ['workspace_id = $1'];
  const params: unknown[] = [w];
  if (!isAdmin) conditions.push(`status = 'published'`);
  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }

  const result = await query(
    `SELECT * FROM research_resource WHERE ${conditions.join(' AND ')} ORDER BY publication_year DESC NULLS LAST, created_at DESC`,
    params,
  );
  return Response.json({ resources: result.rows, categories: CATEGORIES });
}

async function handlePost(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const w = await wid();
  if (!w) return Response.json({ error: 'Workspace missing.' }, { status: 503 });
  const body = await req.json().catch(() => null) as {
    title?: string; authors?: string; sourceUrl?: string; publicationYear?: number; category?: string; summary?: string;
  } | null;
  if (!body?.title || !body.sourceUrl || !CATEGORIES.includes(body.category ?? '')) {
    return Response.json({ error: `title, sourceUrl and a valid category (${CATEGORIES.join('|')}) are required.` }, { status: 400 });
  }
  const result = await query(
    `INSERT INTO research_resource (workspace_id, title, authors, source_url, publication_year, category, summary) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [w, body.title, body.authors || null, body.sourceUrl, body.publicationYear || null, body.category, body.summary || ''],
  );
  return Response.json({ resource: result.rows[0] }, { status: 201 });
}

async function handlePatch(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { resourceId?: string; action?: string } | null;
  if (!body?.resourceId || !['publish', 'archive', 'draft'].includes(body.action ?? '')) {
    return Response.json({ error: 'resourceId and a valid action (publish|archive|draft) are required.' }, { status: 400 });
  }
  const status = body.action === 'publish' ? 'published' : body.action === 'archive' ? 'archived' : 'draft';
  const result = await query(`UPDATE research_resource SET status=$2, updated_at=now() WHERE id=$1 RETURNING *`, [body.resourceId, status]);
  if (!result.rowCount) return Response.json({ error: 'Resource not found.' }, { status: 404 });
  return Response.json({ resource: result.rows[0] });
}

export const GET = withApiErrorLog(handleGet);
export const POST = withApiErrorLog(handlePost);
export const PATCH = withApiErrorLog(handlePatch);
