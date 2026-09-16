export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    const [servers, toolCalls, approvals, gatewayAudit] = await Promise.all([
      client.query(`
        SELECT ms.*, COUNT(DISTINCT mtc.id) as call_count
        FROM mcp_server ms
        LEFT JOIN mcp_tool_call mtc ON mtc.server_id = ms.id
        GROUP BY ms.id
        ORDER BY ms.name
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT mtc.id, mtc.tool_name, mtc.tier, mtc.status, mtc.actor_role,
          mtc.duration_ms, mtc.error_message, mtc.flagged_for_review,
          mtc.prompt_injection_suspected, mtc.created_at,
          ms.name as server_name
        FROM mcp_tool_call mtc
        LEFT JOIN mcp_server ms ON ms.id = mtc.server_id
        ORDER BY mtc.created_at DESC
        LIMIT 100
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT mar.*, rmt.display_name as tier_label
        FROM mcp_approval_request mar
        LEFT JOIN ref_mcp_tier rmt ON rmt.tier_key = mar.tier
        ORDER BY mar.created_at DESC
        LIMIT 50
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT event_type, COUNT(*) as count
        FROM mcp_gateway_audit
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY event_type
        ORDER BY count DESC
      `).catch(() => ({ rows: [] })),
    ]);

    const statusStats = (toolCalls.rows as Array<{ status: string }>).reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    const summary = {
      totalServers: servers.rows.length,
      activeServers: (servers.rows as Array<{ is_enabled: boolean }>).filter(s => s.is_enabled).length,
      totalToolCalls: toolCalls.rows.length,
      pendingApprovals: (approvals.rows as Array<{ status: string }>).filter(a => a.status === 'pending').length,
      flaggedCalls: (toolCalls.rows as Array<{ flagged_for_review: boolean }>).filter(c => c.flagged_for_review).length,
    };

    return Response.json({
      servers: servers.rows,
      toolCalls: toolCalls.rows,
      approvals: approvals.rows,
      gatewayAudit: gatewayAudit.rows,
      statusStats,
      summary,
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as { server_id?: string; is_enabled?: boolean; approval_id?: string; action?: string };

  const client = await pool.connect();
  try {
    if (body.server_id !== undefined && body.is_enabled !== undefined) {
      const res = await client.query(
        `UPDATE mcp_server SET is_enabled = $1 WHERE id = $2 RETURNING *`,
        [body.is_enabled, body.server_id]
      );
      if (!res.rowCount) return Response.json({ error: 'server not found' }, { status: 404 });
      return Response.json({ server: res.rows[0] });
    }

    if (body.approval_id && body.action) {
      const allowed = ['approved', 'rejected'];
      if (!allowed.includes(body.action)) {
        return Response.json({ error: 'action must be approved or rejected' }, { status: 400 });
      }
      const res = await client.query(
        `UPDATE mcp_approval_request SET status = $1, resolved_at = NOW() WHERE id = $2 RETURNING *`,
        [body.action, body.approval_id]
      );
      if (!res.rowCount) return Response.json({ error: 'approval not found' }, { status: 404 });
      return Response.json({ approval: res.rows[0] });
    }

    return Response.json({ error: 'invalid request body' }, { status: 400 });
  } finally {
    client.release();
  }
}
