import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM storyboard_scenes WHERE storyboard_id = $1 ORDER BY scene_number ASC',
      [params.id]
    );
    return Response.json({ scenes: result.rows });
  } catch (err) {
    console.error('[scenes GET]', err);
    return Response.json({ error: 'Failed to fetch scenes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    const body = await req.json() as {
      scene_number?: number;
      shot_type?: string;
      camera_angle?: string;
      description?: string;
      dialogue?: string;
      action?: string;
      duration_seconds?: number;
      visual_notes?: string;
      audio_notes?: string;
    };

    // Auto-assign scene number if not provided
    let sceneNumber = body.scene_number;
    if (!sceneNumber) {
      const maxResult = await pool.query(
        'SELECT COALESCE(MAX(scene_number), 0) + 1 as next FROM storyboard_scenes WHERE storyboard_id = $1',
        [params.id]
      );
      sceneNumber = maxResult.rows[0].next as number;
    }

    const result = await pool.query(
      `INSERT INTO storyboard_scenes
        (storyboard_id, scene_number, shot_type, camera_angle, description, dialogue, action, duration_seconds, visual_notes, audio_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        params.id,
        sceneNumber,
        body.shot_type || 'medium',
        body.camera_angle || 'eye_level',
        body.description || null,
        body.dialogue || null,
        body.action || null,
        body.duration_seconds || 5,
        body.visual_notes || null,
        body.audio_notes || null,
      ]
    );

    // Update total_scenes count on storyboard
    await pool.query(
      `UPDATE storyboards SET total_scenes = (
        SELECT COUNT(*) FROM storyboard_scenes WHERE storyboard_id = $1
      ) WHERE id = $1`,
      [params.id]
    );

    return Response.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('[scenes POST]', err);
    return Response.json({ error: 'Failed to create scene' }, { status: 500 });
  }
}
