import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    const storyboards = await pool.query(`
      SELECT sb.*, vs.title as script_title, vs.project_type as script_type
      FROM storyboards sb
      LEFT JOIN video_scripts vs ON vs.id = sb.script_id
      ORDER BY sb.created_at DESC
    `);

    // Fetch scenes for each storyboard
    const result = await Promise.all(
      storyboards.rows.map(async (sb: Record<string, unknown>) => {
        const scenes = await pool.query(
          'SELECT * FROM storyboard_scenes WHERE storyboard_id = $1 ORDER BY scene_number ASC',
          [sb.id]
        );
        return { ...sb, scenes: scenes.rows };
      })
    );

    return Response.json({ storyboards: result });
  } catch (err) {
    console.error('[storyboards GET]', err);
    return Response.json({ error: 'Failed to fetch storyboards' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    const body = await req.json() as { title: string; script_id?: string };

    const result = await pool.query(
      `INSERT INTO storyboards (title, script_id) VALUES ($1,$2) RETURNING *`,
      [body.title, body.script_id || null]
    );
    return Response.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('[storyboards POST]', err);
    return Response.json({ error: 'Failed to create storyboard' }, { status: 500 });
  }
}
