import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const { id } = await Promise.resolve(params);

  // Ensure tables exist
  await query(`CREATE TABLE IF NOT EXISTS survey_response (
    id SERIAL PRIMARY KEY,
    survey_id INT NOT NULL,
    respondent_email VARCHAR(200),
    respondent_name VARCHAR(200),
    ip_address VARCHAR(50),
    completion_time_seconds INT,
    is_complete BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`, []);

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '100');

  const rows = await query(
    `SELECT r.id, r.respondent_email, r.respondent_name, r.is_complete,
            r.completion_time_seconds, r.started_at, r.completed_at,
            COUNT(a.id) AS answer_count
     FROM survey_response r
     LEFT JOIN survey_answer a ON a.response_id = r.id
     WHERE r.survey_id = $1
     GROUP BY r.id
     ORDER BY r.started_at DESC LIMIT $2`,
    [id, limit]
  );

  const total = await query(`SELECT COUNT(*) FROM survey_response WHERE survey_id=$1`, [id]);
  const complete = await query(`SELECT COUNT(*) FROM survey_response WHERE survey_id=$1 AND is_complete=true`, [id]);
  const totalCount = parseInt(total.rows[0].count);
  const completeCount = parseInt(complete.rows[0].count);

  return Response.json({
    responses: rows.rows,
    stats: {
      total: totalCount,
      complete: completeCount,
      completionRate: totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0,
    },
  });
}
