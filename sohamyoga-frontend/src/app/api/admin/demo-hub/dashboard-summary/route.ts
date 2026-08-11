import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live operational pulse for the Demo Hub's Dashboard tab: last-24h job run
 * counts by status and source, top-called AI models, and open error counts.
 * Reads the same operation_run/model_invocation/error_occurrence tables
 * that back /admin/operations-history — this is a condensed "how is the
 * platform doing right now" view, not a replacement for that page's full
 * drill-down.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [runs24h, bySource, byStatus, models, openErrors, recentRuns] = await Promise.all([
    query<{ total: string; succeeded: string; failed: string; avg_duration_ms: string | null }>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='succeeded') AS succeeded,
              COUNT(*) FILTER (WHERE status IN ('failed','timeout','blocked')) AS failed,
              round(avg(duration_ms))::text AS avg_duration_ms
       FROM operation_run WHERE created_at > now() - interval '24 hours'`,
    ),
    query<{ source: string; count: string }>(
      `SELECT COALESCE(source,'unknown') AS source, COUNT(*) AS count FROM operation_run
       WHERE created_at > now() - interval '24 hours' GROUP BY source ORDER BY count DESC`,
    ),
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) AS count FROM operation_run
       WHERE created_at > now() - interval '24 hours' GROUP BY status ORDER BY count DESC`,
    ),
    query<{ model_name: string; provider: string; calls: string; avg_latency_ms: string | null }>(
      `SELECT m.model_name, m.provider, COUNT(i.id) AS calls, round(avg(i.latency_ms))::text AS avg_latency_ms
       FROM ai_model_master m LEFT JOIN model_invocation i ON i.model_id = m.id AND i.created_at > now() - interval '24 hours'
       WHERE m.enabled GROUP BY m.id ORDER BY calls DESC LIMIT 8`,
    ),
    query<{ count: string }>(`SELECT COUNT(*) AS count FROM error_occurrence WHERE resolved = false`),
    query<{ operation_name: string; status: string; source: string; created_at: string; duration_ms: number | null }>(
      `SELECT operation_name, status, source, created_at, duration_ms FROM operation_run ORDER BY created_at DESC LIMIT 15`,
    ),
  ]);

  return Response.json({
    last24h: {
      total: Number(runs24h.rows[0]?.total ?? 0),
      succeeded: Number(runs24h.rows[0]?.succeeded ?? 0),
      failed: Number(runs24h.rows[0]?.failed ?? 0),
      avgDurationMs: runs24h.rows[0]?.avg_duration_ms ? Number(runs24h.rows[0].avg_duration_ms) : null,
    },
    bySource: bySource.rows.map(r => ({ source: r.source, count: Number(r.count) })),
    byStatus: byStatus.rows.map(r => ({ status: r.status, count: Number(r.count) })),
    models: models.rows.map(r => ({
      modelName: r.model_name, provider: r.provider, calls: Number(r.calls),
      avgLatencyMs: r.avg_latency_ms ? Number(r.avg_latency_ms) : null,
    })),
    openErrors: Number(openErrors.rows[0]?.count ?? 0),
    recentRuns: recentRuns.rows,
  });
}
