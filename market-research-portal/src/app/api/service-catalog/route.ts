import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';
import { withApiErrorLog } from '../../../lib/api-error-log';

async function wid() {
  const r = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  return r.rows[0]?.id;
}

// GET is public — this is the browsable catalog a visitor sees. Admin
// requests (with a valid session) see draft+archived too; anonymous
// requests see only published items.
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
    `SELECT * FROM service_catalog_item WHERE ${conditions.join(' AND ')} ORDER BY category, name`,
    params,
  );
  return Response.json({ items: result.rows });
}

async function handlePost(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const w = await wid();
  if (!w) return Response.json({ error: 'Workspace missing.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { category?: string; name?: string; description?: string; priceNote?: string } | null;
  if (!body?.name || !['market_research', 'digital_marketing'].includes(body.category ?? '')) {
    return Response.json({ error: 'name and a valid category (market_research|digital_marketing) are required.' }, { status: 400 });
  }
  const result = await query(
    `INSERT INTO service_catalog_item (workspace_id, category, name, description, price_note) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [w, body.category, body.name, body.description || '', body.priceNote || null],
  );
  return Response.json({ item: result.rows[0] }, { status: 201 });
}

async function handlePatch(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { itemId?: string; action?: string } | null;
  if (!body?.itemId || !['publish', 'archive', 'draft'].includes(body.action ?? '')) {
    return Response.json({ error: 'itemId and a valid action (publish|archive|draft) are required.' }, { status: 400 });
  }
  const status = body.action === 'publish' ? 'published' : body.action === 'archive' ? 'archived' : 'draft';
  const result = await query(`UPDATE service_catalog_item SET status=$2, updated_at=now() WHERE id=$1 RETURNING *`, [body.itemId, status]);
  if (!result.rowCount) return Response.json({ error: 'Item not found.' }, { status: 404 });
  return Response.json({ item: result.rows[0] });
}

export const GET = withApiErrorLog(handleGet);
export const POST = withApiErrorLog(handlePost);
export const PATCH = withApiErrorLog(handlePatch);
