import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { ollama } from '@/cron/OllamaClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real monitoring surface for one platform: Ollama reachability (actually
// pinged, not assumed), real operation_run history scoped to this platform
// via correlation_id, and real crisis_signal (site-wide -- crisis_signal
// has no platform column, disclosed honestly rather than fabricating a
// per-platform breakdown that doesn't exist).
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { platform } = await params;
  const startedAt = Date.now();
  const ollamaReachable = await ollama.isHealthy();
  const ollamaLatencyMs = Date.now() - startedAt;

  const [runs, crisis] = await Promise.all([
    query<{ id: string; operation_type: string; operation_name: string; status: string; started_at: string; completed_at: string | null; duration_ms: string | null }>(
      `SELECT id, operation_type, operation_name, status, started_at, completed_at, duration_ms
       FROM operation_run WHERE correlation_id = $1 ORDER BY started_at DESC LIMIT 50`,
      [platform],
    ),
    query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM crisis_signal WHERE is_crisis = true AND window_date >= CURRENT_DATE - interval '7 days'`),
  ]);

  const byType = runs.rows.reduce((acc: Record<string, number>, r) => ({ ...acc, [r.operation_type]: (acc[r.operation_type] ?? 0) + 1 }), {});
  const runningNow = runs.rows.filter((r) => r.status === 'running').length;

  return Response.json({
    platform,
    ollama: { reachable: ollamaReachable, latencyMs: ollamaLatencyMs, checkedAt: new Date().toISOString() },
    runs: runs.rows,
    summary: { totalRuns: runs.rowCount, byType, runningNow },
    crisisSignal: { note: 'crisis_signal has no platform column -- this is a site-wide count, not platform-specific.', recentCrisisDays7d: Number(crisis.rows[0].n) },
  });
}
