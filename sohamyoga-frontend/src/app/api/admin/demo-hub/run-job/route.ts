import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { CRON_JOBS } from '@/cron/CronRegistry';
import { JOB_MODULES } from '@/cron/jobModules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * On-demand execution of a registered cron job, for the Demo Showcase Hub's
 * "Run Now" control. Runs the exact same job module the scheduled cron
 * runner uses (src/cron/jobModules.ts) — this is not a simulation, it is the
 * real job hitting the real database and, for AI jobs, the real Ollama
 * daemon. Every run is recorded in operation_run so it shows up alongside
 * scheduled runs in /admin/operations-history.
 */
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { name?: string } | null;
  const jobName = body?.name;
  if (!jobName) return Response.json({ error: 'name is required.' }, { status: 400 });

  const job = CRON_JOBS.find(j => j.name === jobName);
  if (!job) return Response.json({ error: `Unknown job: ${jobName}` }, { status: 404 });

  const loadModule = JOB_MODULES[job.module];
  if (!loadModule) return Response.json({ error: `No module registered for ${job.module}` }, { status: 500 });

  const component = await query<{ id: string }>(`SELECT id FROM platform_component WHERE component_key = 'soham-next'`);
  if (!component.rowCount) return Response.json({ error: 'soham-next platform_component is not seeded.' }, { status: 500 });
  const componentId = component.rows[0].id;

  const started = Date.now();
  const run = await query<{ id: string }>(
    `INSERT INTO operation_run (component_id, operation_type, operation_name, status, actor_type, actor_id, source, started_at)
     VALUES ($1, 'cron_manual_run', $2, 'running', 'admin', $3, 'demo-hub', now()) RETURNING id`,
    [componentId, job.name, principal?.email ?? 'unknown'],
  );
  const runId = run.rows[0].id;

  try {
    const mod = await loadModule();
    await mod.run();
    const durationMs = Date.now() - started;
    await query(
      `UPDATE operation_run SET status='succeeded', duration_ms=$2, completed_at=now() WHERE id=$1`,
      [runId, durationMs],
    );
    return Response.json({ status: 'succeeded', durationMs, jobName: job.name });
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE operation_run SET status='failed', duration_ms=$2, completed_at=now(), output_metadata=$3 WHERE id=$1`,
      [runId, durationMs, JSON.stringify({ error: message })],
    );
    return Response.json({ status: 'failed', durationMs, jobName: job.name, error: message }, { status: 502 });
  }
}
