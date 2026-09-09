import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real operation log + audit trail for one platform: operation_run rows
// (correlation_id = platform) joined with their operation_event detail.
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { platform } = await params;

  const runs = await query<{
    id: string; operation_type: string; operation_name: string; status: string;
    actor_id: string | null; started_at: string | null; completed_at: string | null;
    duration_ms: string | null; output_metadata: Record<string, unknown>;
  }>(
    `SELECT id, operation_type, operation_name, status, actor_id, started_at, completed_at, duration_ms, output_metadata
     FROM operation_run WHERE correlation_id = $1 ORDER BY started_at DESC LIMIT 200`,
    [platform],
  );
  const runIds = runs.rows.map((r) => r.id);
  const events = runIds.length
    ? await query<{ run_id: string; severity: string; event_code: string; stage: string | null; message: string; occurred_at: string }>(
        `SELECT run_id, severity, event_code, stage, message, occurred_at FROM operation_event WHERE run_id = ANY($1::uuid[]) ORDER BY occurred_at DESC LIMIT 200`,
        [runIds],
      )
    : { rows: [] };

  return Response.json({
    platform,
    runs: runs.rows.map((r) => ({
      ...r,
      errorMessage: (r.output_metadata as { error?: string } | null)?.error ?? null,
      events: events.rows.filter((e) => e.run_id === r.id),
    })),
  });
}
