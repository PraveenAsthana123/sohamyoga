import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { computeCourseHealth } from '@/domain/video/CourseHealthScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Video Course -- a real curriculum layer (Course -> Module -> Lesson)
// wrapping the existing real video_asset script/render pipeline. See
// src/domain/video/db-schema-course.sql.
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const courses = await query<{ id: string; title: string; description: string; status: string; created_at: string }>(
    `SELECT id, title, description, status, created_at FROM video_course WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId],
  );

  const lessonRows = await query<{
    course_id: string; video_asset_id: string | null; script_status: string | null; render_status: string | null;
  }>(
    `SELECT m.course_id, l.video_asset_id, va.script_status, va.render_status
     FROM video_course_lesson l
     JOIN video_course_module m ON m.id = l.module_id
     LEFT JOIN video_asset va ON va.id = l.video_asset_id
     WHERE m.course_id = ANY($1::uuid[])`,
    [courses.rows.map(c => c.id)],
  );

  return Response.json({
    courses: courses.rows.map(c => {
      const lessons = lessonRows.rows.filter(l => l.course_id === c.id).map(l => ({
        hasVideo: !!l.video_asset_id, scriptStatus: l.script_status, renderStatus: l.render_status,
      }));
      return {
        id: c.id, title: c.title, description: c.description, status: c.status, createdAt: c.created_at,
        health: computeCourseHealth(lessons),
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { title?: string; description?: string } | null;
  if (!body?.title?.trim()) return Response.json({ error: 'title is required.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO video_course (tenant_id, title, description, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
    [tenantId, body.title.trim(), body.description ?? '', principal!.email ?? principal!.id],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
