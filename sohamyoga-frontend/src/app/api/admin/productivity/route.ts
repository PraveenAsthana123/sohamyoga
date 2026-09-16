export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import type { PoolClient } from 'pg';
import { requireAdmin } from '@/lib/admin-auth';

async function ensureSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS productivity_metric (
      id SERIAL PRIMARY KEY,
      team TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value NUMERIC NOT NULL,
      metric_unit TEXT DEFAULT 'count',
      period_type TEXT DEFAULT 'weekly',
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      target_value NUMERIC,
      achievement_pct NUMERIC,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS productivity_task (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      assigned_to TEXT,
      team TEXT,
      related_process TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'todo',
      estimated_hours NUMERIC,
      actual_hours NUMERIC,
      due_date TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      tags TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await getPool().connect();
  try {
    await ensureSchema(client);

    const [metricsResult, tasksResult, teamSummaryResult] = await Promise.all([
      client.query(`
        SELECT * FROM productivity_metric
        WHERE period_start >= NOW() - INTERVAL '12 weeks'
        ORDER BY period_start DESC, team, metric_name
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT * FROM productivity_task
        ORDER BY created_at DESC
        LIMIT 200
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT
          team,
          COUNT(*) FILTER (WHERE status = 'done') AS completed_tasks,
          ROUND(AVG(achievement_pct), 1) AS avg_achievement_pct,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'done' AND (due_date IS NULL OR completed_at <= due_date))
            / NULLIF(COUNT(*) FILTER (WHERE status = 'done'), 0),
          1) AS on_time_rate
        FROM (
          SELECT t.team, t.status, t.due_date, t.completed_at, NULL::numeric AS achievement_pct
          FROM productivity_task t
          UNION ALL
          SELECT m.team, 'metric' AS status, NULL AS due_date, NULL AS completed_at, m.achievement_pct
          FROM productivity_metric m
          WHERE m.period_start >= NOW() - INTERVAL '4 weeks'
        ) combined
        GROUP BY team
        ORDER BY team
      `).catch(() => ({ rows: [] })),
    ]);

    return Response.json({
      metrics: metricsResult.rows,
      tasks: tasksResult.rows,
      teamSummary: teamSummaryResult.rows,
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as Record<string, unknown>;
  const { type } = body;

  const client = await getPool().connect();
  try {
    await ensureSchema(client);

    if (type === 'metric') {
      const { team, metric_name, metric_value, metric_unit, period_type,
        period_start, period_end, target_value, notes } = body;
      if (!team || !metric_name || metric_value === undefined || !period_start || !period_end) {
        return Response.json({ error: 'team, metric_name, metric_value, period_start, period_end required' }, { status: 400 });
      }
      const achievementPct = target_value ? (Number(metric_value) / Number(target_value)) * 100 : null;
      const result = await client.query(`
        INSERT INTO productivity_metric
          (team, metric_name, metric_value, metric_unit, period_type, period_start, period_end, target_value, achievement_pct, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [team, metric_name, metric_value, metric_unit || 'count', period_type || 'weekly',
          period_start, period_end, target_value || null, achievementPct, notes || null]);
      return Response.json({ metric: result.rows[0] }, { status: 201 });

    } else if (type === 'task') {
      const { title, assigned_to, team, related_process, priority,
        estimated_hours, due_date, tags } = body;
      if (!title) return Response.json({ error: 'title required' }, { status: 400 });
      const result = await client.query(`
        INSERT INTO productivity_task
          (title, assigned_to, team, related_process, priority, estimated_hours, due_date, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [title, assigned_to || null, team || null, related_process || null,
          priority || 'medium', estimated_hours || null,
          due_date || null, tags || null]);
      return Response.json({ task: result.rows[0] }, { status: 201 });

    } else {
      return Response.json({ error: 'type must be "metric" or "task"' }, { status: 400 });
    }
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as Record<string, unknown>;
  const { id, status, actual_hours, completed_at } = body;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status !== undefined) { sets.push(`status = $${idx++}`); params.push(status); }
  if (actual_hours !== undefined) { sets.push(`actual_hours = $${idx++}`); params.push(actual_hours); }
  if (completed_at !== undefined) { sets.push(`completed_at = $${idx++}`); params.push(completed_at); }

  if (!sets.length) return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  params.push(id);

  const client = await getPool().connect();
  try {
    const result = await client.query(
      `UPDATE productivity_task SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (!result.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ task: result.rows[0] });
  } finally {
    client.release();
  }
}
