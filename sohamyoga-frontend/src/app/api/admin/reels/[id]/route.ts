import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM reels WHERE id=$1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ reel: rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const body = await req.json() as Record<string, unknown>;
    const allowed = [
      'title','caption','hashtags','platform','video_url','thumbnail_url','status',
      'scheduled_at','audio_name','duration_seconds','is_trending_audio',
      'views','likes','comments','shares','saves','reach','engagement_rate',
    ];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const key of allowed) {
      if (key in body) {
        vals.push(body[key]);
        sets.push(`${key}=$${vals.length}`);
      }
    }
    if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await pool.query(
      `UPDATE reels SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ reel: rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    await pool.query(`DELETE FROM reels WHERE id=$1`, [params.id]);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
