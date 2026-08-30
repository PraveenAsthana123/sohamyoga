import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { CRON_JOBS } from '@/cron/CronRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One research_topic (looked up by slug, e.g. "population") within one
 * framework (looked up by slug, e.g. "17-layer-forecasting"), plus its 3
 * ordered tabs (process / input / output). Job Schedule is NOT a 4th
 * research_topic_tab row — when the topic has job_name set, this route
 * additionally returns the matching CRON_JOBS entry (schedule/enabled,
 * imported directly — it's a TS array, not a DB table) and the latest
 * operation_run row for that job name, so the client can render a real
 * Job Schedule tab without a 4th tab_key value ever existing in Postgres.
 * 404s when the framework or topic slug doesn't match a seeded row, or
 * when the topic doesn't belong to that framework.
 */
export async function GET(req: NextRequest, { params }: { params: { frameworkSlug: string; topicId: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { frameworkSlug, topicId } = params;

  const frameworkResult = await query<{ id: string; slug: string; name: string }>(
    `SELECT id, slug, name FROM research_framework WHERE slug = $1`,
    [frameworkSlug],
  );
  const framework = frameworkResult.rows[0];
  if (!framework) return Response.json({ error: `Unknown research framework "${frameworkSlug}".` }, { status: 404 });

  const topicResult = await query<{
    id: string; slug: string; name: string; layer_number: number; summary: string; job_name: string | null; framework_id: string; created_at: string;
  }>(
    `SELECT id, slug, name, layer_number, summary, job_name, framework_id, created_at FROM research_topic WHERE slug = $1`,
    [topicId],
  );
  const topic = topicResult.rows[0];
  if (!topic || topic.framework_id !== framework.id) {
    return Response.json({ error: `Unknown research topic "${topicId}" in framework "${frameworkSlug}".` }, { status: 404 });
  }

  const tabs = await query<{ tab_key: string; tab_label: string; content: string; sort_order: number }>(
    `SELECT tab_key, tab_label, content, sort_order FROM research_topic_tab WHERE topic_id = $1 ORDER BY sort_order`,
    [topic.id],
  );

  let jobSchedule: {
    name: string; schedule: string; description: string; enabled: boolean; timeoutMs: number;
    lastRun: { status: string; startedAt: string | null; completedAt: string | null; durationMs: number | null } | null;
  } | null = null;

  if (topic.job_name) {
    const jobDef = CRON_JOBS.find(j => j.name === topic.job_name);
    if (jobDef) {
      const lastRunResult = await query<{ status: string; started_at: string | null; completed_at: string | null; duration_ms: number | null }>(
        `SELECT status, started_at, completed_at, duration_ms
         FROM operation_run
         WHERE operation_name = $1
         ORDER BY started_at DESC NULLS LAST, created_at DESC
         LIMIT 1`,
        [topic.job_name],
      );
      const lastRun = lastRunResult.rows[0];
      jobSchedule = {
        name: jobDef.name,
        schedule: jobDef.schedule,
        description: jobDef.description,
        enabled: jobDef.enabled,
        timeoutMs: jobDef.timeoutMs,
        lastRun: lastRun
          ? { status: lastRun.status, startedAt: lastRun.started_at, completedAt: lastRun.completed_at, durationMs: lastRun.duration_ms }
          : null,
      };
    }
  }

  return Response.json({
    framework: { slug: framework.slug, name: framework.name },
    id: topic.id,
    slug: topic.slug,
    name: topic.name,
    layerNumber: topic.layer_number,
    summary: topic.summary,
    jobName: topic.job_name,
    createdAt: topic.created_at,
    tabs: tabs.rows.map(t => ({
      key: t.tab_key,
      label: t.tab_label,
      content: t.content,
      sortOrder: t.sort_order,
    })),
    jobSchedule,
  });
}
