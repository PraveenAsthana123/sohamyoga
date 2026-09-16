export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'overview';

  const client = await pool.connect();
  try {
    if (type === 'asanas') {
      const res = await client.query(`
        SELECT a.*,
          COALESCE(
            (SELECT array_agg(s.name) FROM asana_style ast JOIN ref_yoga_style s ON s.id = ast.style_id WHERE ast.asana_id = a.id),
            '{}'::text[]
          ) AS styles,
          COALESCE(
            (SELECT array_agg(g.name) FROM asana_goal ag JOIN ref_yoga_goal g ON g.id = ag.goal_id WHERE ag.asana_id = a.id),
            '{}'::text[]
          ) AS goals
        FROM asana a
        ORDER BY a.difficulty_level, a.sanskrit_name
      `);
      return Response.json({ asanas: res.rows });
    }

    if (type === 'styles') {
      const res = await client.query(`
        SELECT rys.*,
          COUNT(DISTINCT ast.asana_id) as asana_count
        FROM ref_yoga_style rys
        LEFT JOIN asana_style ast ON ast.style_id = rys.id
        GROUP BY rys.id
        ORDER BY rys.name
      `);
      return Response.json({ styles: res.rows });
    }

    // Overview: summary stats
    const asanaCount = await client.query('SELECT COUNT(*) as count, difficulty_level FROM asana GROUP BY difficulty_level ORDER BY difficulty_level');
    const styleCount = await client.query('SELECT COUNT(*) as count FROM ref_yoga_style');
    const sequenceCount = await client.query('SELECT COUNT(*) as count FROM class_sequence');
    const goalCount = await client.query('SELECT COUNT(*) as count FROM ref_yoga_goal');
    const planPoseCount = await client.query('SELECT COUNT(*) as count FROM plan_pose');

    const diffLevels = asanaCount.rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.difficulty_level] = Number(r.count);
      return acc;
    }, {});

    return Response.json({
      summary: {
        totalAsanas: asanaCount.rows.reduce((s, r) => s + Number(r.count), 0),
        totalStyles: Number(styleCount.rows[0]?.count ?? 0),
        totalSequences: Number(sequenceCount.rows[0]?.count ?? 0),
        totalGoals: Number(goalCount.rows[0]?.count ?? 0),
        planPoses: Number(planPoseCount.rows[0]?.count ?? 0),
        difficultyBreakdown: diffLevels,
      },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as Record<string, unknown>;
  const { sanskrit_name, english_name, description, difficulty_level, duration_seconds, tenant_id } = body;

  if (!sanskrit_name || !english_name || !difficulty_level) {
    return Response.json({ error: 'sanskrit_name, english_name, difficulty_level required' }, { status: 400 });
  }

  // Use first tenant or provided
  const client = await pool.connect();
  try {
    const tenantRes = await client.query('SELECT id FROM tenant LIMIT 1');
    const tid = tenant_id ?? tenantRes.rows[0]?.id;
    if (!tid) return Response.json({ error: 'No tenant found' }, { status: 400 });

    const res = await client.query(
      `INSERT INTO asana (tenant_id, sanskrit_name, english_name, description, difficulty_level, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tid, sanskrit_name, english_name, description ?? '', difficulty_level, duration_seconds ?? null]
    );
    return Response.json({ asana: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as Record<string, unknown>;
  const { id, ...fields } = body;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const allowed = ['sanskrit_name', 'english_name', 'description', 'difficulty_level', 'duration_seconds', 'image_url', 'video_url', 'is_active'];
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { updates.push(`${k} = $${i++}`); values.push(v); }
  }
  if (!updates.length) return Response.json({ error: 'no valid fields' }, { status: 400 });
  values.push(id);

  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE asana SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      values
    );
    if (!res.rowCount) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ asana: res.rows[0] });
  } finally {
    client.release();
  }
}
