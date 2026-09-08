import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';
import { withApiErrorLog } from '../../../lib/api-error-log';

const CATEGORIES = ['question','shock','curiosity','problem','contrarian','statistic','mistake','promise','transformation','story','challenge','fomo','comparison','before_after'];

async function handleGet(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const w = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  const workspaceId = w.rows[0]?.id;
  if (!workspaceId) return Response.json({ error: 'Workspace missing.' }, { status: 503 });

  // Real performance, never fabricated: joins to content_factory_metric via
  // any variant this hook is attached to. A hook with no attached, measured
  // variant yet correctly shows null/0, not an invented number.
  const result = await query(
    `SELECT h.*,
            count(DISTINCT v.id) AS attached_variants,
            coalesce(sum(m.views), 0) AS total_views,
            CASE WHEN sum(m.views) > 0 THEN round(sum(m.completions)::numeric / sum(m.views) * 100, 1) ELSE null END AS completion_rate_pct
     FROM content_hook h
     LEFT JOIN content_factory_variant v ON v.hook_id = h.id
     LEFT JOIN content_factory_metric m ON m.variant_id = v.id
     WHERE h.workspace_id = $1
     GROUP BY h.id
     ORDER BY h.created_at DESC`,
    [workspaceId],
  );
  return Response.json({ hooks: result.rows, categories: CATEGORIES });
}

async function handlePost(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { text?: string; category?: string; topic?: string; platform?: string } | null;
  if (!body?.text || !CATEGORIES.includes(body.category ?? '')) {
    return Response.json({ error: `text and a valid category (${CATEGORIES.join('|')}) are required.` }, { status: 400 });
  }
  const w = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  const workspaceId = w.rows[0]?.id;
  if (!workspaceId) return Response.json({ error: 'Workspace missing.' }, { status: 503 });

  const result = await query(
    `INSERT INTO content_hook (workspace_id, text, category, topic, platform) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [workspaceId, body.text, body.category, body.topic || null, body.platform || null],
  );
  return Response.json({ hook: result.rows[0] }, { status: 201 });
}

async function handlePatch(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { hookId?: string; action?: string } | null;
  if (!body?.hookId || !['approve', 'archive'].includes(body.action ?? '')) {
    return Response.json({ error: 'hookId and a valid action (approve|archive) are required.' }, { status: 400 });
  }
  const status = body.action === 'approve' ? 'approved' : 'archived';
  const result = await query(`UPDATE content_hook SET status=$2, updated_at=now() WHERE id=$1 RETURNING *`, [body.hookId, status]);
  if (!result.rowCount) return Response.json({ error: 'Hook not found.' }, { status: 404 });
  return Response.json({ hook: result.rows[0] });
}

export const GET = withApiErrorLog(handleGet);
export const POST = withApiErrorLog(handlePost);
export const PATCH = withApiErrorLog(handlePatch);
