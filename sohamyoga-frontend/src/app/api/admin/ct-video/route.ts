export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [scriptsRes, storyboardsRes, postProdRes, animRes, repurposeRes] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='in_progress')::int AS in_progress FROM video_scripts`).catch(() => ({ rows: [{ total: 0, in_progress: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS total FROM video_storyboards`).catch(() => ({ rows: [{ total: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('queued','processing'))::int AS in_queue, COUNT(*) FILTER (WHERE status='done' AND updated_at >= NOW()-INTERVAL '7 days')::int AS done_week FROM post_production_jobs`).catch(() => ({ rows: [{ total: 0, in_queue: 0, done_week: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS total FROM animation_projects`).catch(() => ({ rows: [{ total: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status IN ('queued','processing'))::int AS active FROM repurpose_jobs`).catch(() => ({ rows: [{ total: 0, active: 0 }] })),
    ]);

    const scripts = scriptsRes.rows[0] ?? { total: 0, in_progress: 0 };
    const storyboards = storyboardsRes.rows[0]?.total ?? 0;
    const postProd = postProdRes.rows[0] ?? { total: 0, in_queue: 0, done_week: 0 };
    const animations = animRes.rows[0]?.total ?? 0;
    const repurpose = repurposeRes.rows[0] ?? { total: 0, active: 0 };

    const totalProjects = scripts.total + animations + repurpose.total;
    const inProduction = scripts.in_progress + postProd.in_queue + repurpose.active;
    const completedWeek = postProd.done_week;

    const productionScore = inProduction > 0 ? 34 : 0;
    const outputScore = completedWeek > 0 ? 33 : 0;
    const pipelineScore = storyboards > 0 ? 33 : 0;
    const health_score = Math.min(100, productionScore + outputScore + pipelineScore);

    const activeJobsRes = await client.query(`
      SELECT 'post_production' AS type, id::text, status, created_at FROM post_production_jobs WHERE status IN ('queued','processing')
      UNION ALL
      SELECT 'repurpose' AS type, id::text, status, created_at FROM repurpose_jobs WHERE status IN ('queued','processing')
      ORDER BY created_at DESC LIMIT 15
    `).catch(() => ({ rows: [] }));

    const completedRes = await client.query(`
      SELECT id::text, status, updated_at FROM post_production_jobs WHERE status='done' ORDER BY updated_at DESC LIMIT 10
    `).catch(() => ({ rows: [] }));

    return Response.json({
      health_score,
      traffic_light: health_score >= 70 ? 'green' : health_score >= 40 ? 'yellow' : 'red',
      kpis: [
        { label: 'Total Projects', value: totalProjects, target: 10, trend: totalProjects >= 10 ? 'up' : 'down', unit: 'projects' },
        { label: 'In Production', value: inProduction, target: 3, trend: inProduction > 0 ? 'up' : 'down', unit: 'active' },
        { label: 'Completed (7d)', value: completedWeek, target: 2, trend: completedWeek >= 2 ? 'up' : 'down', unit: 'videos' },
        { label: 'Scripts', value: scripts.total, target: 5, trend: scripts.total >= 5 ? 'up' : 'down', unit: 'total' },
        { label: 'Animations', value: animations, target: 3, trend: animations >= 3 ? 'up' : 'down', unit: 'projects' },
      ],
      active_jobs: activeJobsRes.rows,
      completed: completedRes.rows,
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
