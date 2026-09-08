import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const modules = await query<{ id: string; title: string; sort_order: number }>(
    `SELECT id, title, sort_order FROM video_course_module WHERE course_id = $1 ORDER BY sort_order, created_at`,
    [id],
  );
  const lessons = await query<{
    id: string; module_id: string; title: string; sort_order: number; video_asset_id: string | null;
    video_title: string | null; script_status: string | null; render_status: string | null;
  }>(
    `SELECT l.id, l.module_id, l.title, l.sort_order, l.video_asset_id,
            va.title AS video_title, va.script_status, va.render_status
     FROM video_course_lesson l
     LEFT JOIN video_asset va ON va.id = l.video_asset_id
     WHERE l.module_id = ANY($1::uuid[]) ORDER BY l.sort_order, l.created_at`,
    [modules.rows.map(m => m.id)],
  );

  return Response.json({
    modules: modules.rows.map(m => ({
      id: m.id, title: m.title, sortOrder: m.sort_order,
      lessons: lessons.rows.filter(l => l.module_id === m.id).map(l => ({
        id: l.id, title: l.title, sortOrder: l.sort_order, videoAssetId: l.video_asset_id,
        videoTitle: l.video_title, scriptStatus: l.script_status, renderStatus: l.render_status,
      })),
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { title?: string } | null;
  if (!body?.title?.trim()) return Response.json({ error: 'title is required.' }, { status: 400 });

  const course = await query(`SELECT 1 FROM video_course WHERE id = $1`, [id]);
  if (!course.rowCount) return Response.json({ error: 'Course not found.' }, { status: 404 });

  const countRes = await query<{ n: string }>(`SELECT count(*)::text AS n FROM video_course_module WHERE course_id = $1`, [id]);
  const result = await query<{ id: string }>(
    `INSERT INTO video_course_module (course_id, title, sort_order) VALUES ($1,$2,$3) RETURNING id`,
    [id, body.title.trim(), Number(countRes.rows[0].n)],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
