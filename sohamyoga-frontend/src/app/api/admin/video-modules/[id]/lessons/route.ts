import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { title?: string; videoAssetId?: string } | null;
  if (!body?.title?.trim()) return Response.json({ error: 'title is required.' }, { status: 400 });

  const moduleRow = await query(`SELECT 1 FROM video_course_module WHERE id = $1`, [id]);
  if (!moduleRow.rowCount) return Response.json({ error: 'Module not found.' }, { status: 404 });

  if (body.videoAssetId) {
    const video = await query(`SELECT 1 FROM video_asset WHERE id = $1`, [body.videoAssetId]);
    if (!video.rowCount) return Response.json({ error: 'videoAssetId does not reference a real video_asset row.' }, { status: 400 });
  }

  const countRes = await query<{ n: string }>(`SELECT count(*)::text AS n FROM video_course_lesson WHERE module_id = $1`, [id]);
  const result = await query<{ id: string }>(
    `INSERT INTO video_course_lesson (module_id, title, sort_order, video_asset_id) VALUES ($1,$2,$3,$4) RETURNING id`,
    [id, body.title.trim(), Number(countRes.rows[0].n), body.videoAssetId ?? null],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
