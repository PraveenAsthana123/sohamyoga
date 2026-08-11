import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Approve or reject a pending social_mcp_approval_log row — the missing
 * other half of the MCP gateway's request_approval tool. Approving mints
 * approval_token, which validateApproval() in /api/mcp/social/route.ts
 * requires before schedule_post/publish_post/retry_failed_post will run.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { decision?: 'approved' | 'rejected' } | null;
  if (body?.decision !== 'approved' && body?.decision !== 'rejected') {
    return Response.json({ error: "decision must be 'approved' or 'rejected'." }, { status: 400 });
  }

  const token = body.decision === 'approved' ? randomBytes(24).toString('hex') : null;
  const result = await query<{ id: string; status: string; approval_token: string | null; expires_at: string }>(
    `UPDATE social_mcp_approval_log
     SET status = $2, approved_by = $3::uuid, approval_token = $4
     WHERE id = $1::uuid AND status = 'pending'
     RETURNING id, status, approval_token, expires_at`,
    [params.id, body.decision, principal?.id, token],
  );
  if (!result.rowCount) return Response.json({ error: 'Approval request not found or already decided.' }, { status: 404 });

  return Response.json({ approval: result.rows[0] });
}
