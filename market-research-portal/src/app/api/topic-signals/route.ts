import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';
import { withApiErrorLog } from '../../../lib/api-error-log';

async function handleGet(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const w = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  const workspaceId = w.rows[0]?.id;
  if (!workspaceId) return Response.json({ error: 'Workspace missing.' }, { status: 503 });

  const result = await query(
    `SELECT * FROM topic_signal WHERE workspace_id = $1 ORDER BY captured_on DESC, signal_strength DESC LIMIT 100`,
    [workspaceId],
  );
  return Response.json({ signals: result.rows });
}

export const GET = withApiErrorLog(handleGet);
