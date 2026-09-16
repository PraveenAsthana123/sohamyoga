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
    const [
      servers,
      toolCalls,
      approvals,
      tiers,
      gatewayAudit,
      aiModules,
      auditLog,
    ] = await Promise.all([
      client.query(`
        SELECT ms.*, COUNT(DISTINCT mtc.id)::int AS call_count
        FROM mcp_server ms
        LEFT JOIN mcp_tool_call mtc ON mtc.server_id = ms.id
        GROUP BY ms.id
        ORDER BY ms.name
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT mtc.id, mtc.tool_name, mtc.tier, mtc.status, mtc.actor_role,
          mtc.duration_ms, mtc.error_message, mtc.flagged_for_review,
          mtc.prompt_injection_suspected, mtc.created_at,
          ms.name AS server_name
        FROM mcp_tool_call mtc
        LEFT JOIN mcp_server ms ON ms.id = mtc.server_id
        ORDER BY mtc.created_at DESC
        LIMIT 500
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT mar.*, rmt.display_name AS tier_label
        FROM mcp_approval_request mar
        LEFT JOIN ref_mcp_tier rmt ON rmt.tier_key = mar.tier
        ORDER BY mar.created_at DESC
        LIMIT 100
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT tier_key, display_name, sort_order, requires_human_review,
               auto_execute, description
        FROM ref_mcp_tier
        ORDER BY sort_order
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT event_type, COUNT(*)::int AS count
        FROM mcp_gateway_audit
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY event_type
        ORDER BY count DESC
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT id, module_key, name, description, built_status, app,
               input_desc, process_desc, output_desc, final_outcome,
               job_name, last_verified_at, verified_by, updated_at
        FROM module_registry
        WHERE job_name IS NOT NULL
        ORDER BY app, name
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT id, action, entity_type, entity_id, performed_by,
               created_at, details
        FROM audit_log
        WHERE action ILIKE '%ai%'
           OR action ILIKE '%mcp%'
           OR action ILIKE '%ollama%'
        ORDER BY created_at DESC
        LIMIT 100
      `).catch(() => ({ rows: [] })),
    ]);

    // ── Summary / KPI ──────────────────────────────────────────────────────
    const tcRows = toolCalls.rows as Array<{
      status: string;
      flagged_for_review: boolean;
      prompt_injection_suspected: boolean;
      created_at: string;
    }>;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summary = {
      totalAiModels: aiModules.rows.length,
      activeAiJobs: (aiModules.rows as Array<{ job_name: string | null }>).filter(m => m.job_name).length,
      aiCallsToday: tcRows.filter(r => new Date(r.created_at) >= today).length,
      governanceViolations: (approvals.rows as Array<{ status: string }>).filter(a => a.status === 'rejected').length,
      pendingApprovals: (approvals.rows as Array<{ status: string }>).filter(a => a.status === 'pending').length,
      flaggedCalls: tcRows.filter(r => r.flagged_for_review).length,
      injectionAttempts: tcRows.filter(r => r.prompt_injection_suspected).length,
      failedCalls: tcRows.filter(r => r.status === 'failed').length,
      totalCalls: tcRows.length,
      securityScore: Math.max(
        0,
        100 -
          tcRows.filter(r => r.prompt_injection_suspected).length * 10 -
          tcRows.filter(r => r.flagged_for_review).length * 5,
      ),
    };

    // ── Error rate by tool ─────────────────────────────────────────────────
    const toolStats: Record<string, { total: number; failed: number }> = {};
    for (const r of tcRows) {
      const tool = (r as unknown as { tool_name: string }).tool_name;
      if (!toolStats[tool]) toolStats[tool] = { total: 0, failed: 0 };
      toolStats[tool].total++;
      if (r.status === 'failed') toolStats[tool].failed++;
    }

    return Response.json({
      servers: servers.rows,
      toolCalls: toolCalls.rows,
      approvals: approvals.rows,
      tiers: tiers.rows,
      gatewayAudit: gatewayAudit.rows,
      aiModules: aiModules.rows,
      auditLog: auditLog.rows,
      toolStats,
      summary,
    });
  } finally {
    client.release();
  }
}
