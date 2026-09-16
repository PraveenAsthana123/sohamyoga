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
    const result = await pool.query('SELECT * FROM video_scripts WHERE id = $1', [params.id]);
    if (result.rows.length === 0) return Response.json({ error: 'Script not found' }, { status: 404 });
    return Response.json(result.rows[0]);
  } catch (err) {
    console.error('[scripts/:id GET]', err);
    return Response.json({ error: 'Failed to fetch script' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    const body = await req.json() as Record<string, unknown>;

    const allowed = ['title', 'project_type', 'duration_target_seconds', 'status', 'script_body', 'hook',
      'call_to_action', 'target_audience', 'tone', 'voice_notes', 'approved_by', 'approved_at'];
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    // Auto-increment revision_count if script_body changes
    if ('script_body' in body) {
      sets.push(`revision_count = revision_count + 1`);
    }

    // Auto-set word_count if script_body present
    if ('script_body' in body && typeof body.script_body === 'string') {
      const wc = body.script_body.trim().split(/\s+/).filter(Boolean).length;
      sets.push(`word_count = $${idx++}`);
      values.push(wc);
    }

    if (sets.length === 0) return Response.json({ error: 'No valid fields to update' }, { status: 400 });

    values.push(params.id);
    const result = await pool.query(
      `UPDATE video_scripts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return Response.json({ error: 'Script not found' }, { status: 404 });
    return Response.json(result.rows[0]);
  } catch (err) {
    console.error('[scripts/:id PATCH]', err);
    return Response.json({ error: 'Failed to update script' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    await pool.query('DELETE FROM video_scripts WHERE id = $1', [params.id]);
    return Response.json({ success: true });
  } catch (err) {
    console.error('[scripts/:id DELETE]', err);
    return Response.json({ error: 'Failed to delete script' }, { status: 500 });
  }
}
