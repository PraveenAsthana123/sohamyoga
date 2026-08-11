import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lists pending/recent approval requests (social_mcp_approval_log). The MCP
 * gateway's request_approval tool could always create a pending row, but
 * nothing anywhere could ever move it to 'approved' — schedule_post/
 * publish_post/retry_failed_post require an approved, unconsumed token
 * (validateApproval in /api/mcp/social/route.ts) that no code path ever
 * produced. This route plus approve/reject complete that half-built
 * workflow.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const status = req.nextUrl.searchParams.get('status');
  const rows = await query(
    `SELECT al.id, al.tool_name, al.draft_id, al.status, al.expires_at, al.notes, al.created_at,
            d.master_text, d.content_type
     FROM social_mcp_approval_log al
     LEFT JOIN social_content_draft d ON d.id = al.draft_id
     WHERE ($1::text IS NULL OR al.status = $1)
     ORDER BY al.created_at DESC LIMIT 100`,
    [status],
  );
  return Response.json({ approvals: rows.rows });
}
