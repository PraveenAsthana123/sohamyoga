import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [trend, topCourses, revenueByCategory, completionRates] = await Promise.all([
      client.query(`
        SELECT to_char(date_trunc('month', enrolled_at), 'Mon YYYY') AS month,
               date_trunc('month', enrolled_at) AS month_date,
               COUNT(*) AS enrollments,
               COALESCE(SUM(payment_amount), 0) AS revenue
        FROM el_enrollment
        WHERE enrolled_at >= NOW() - INTERVAL '6 months'
          AND refunded = false
        GROUP BY date_trunc('month', enrolled_at)
        ORDER BY month_date
      `),
      client.query(`
        SELECT c.id, c.title, c.category, c.avg_rating,
               COUNT(e.id) AS enrollment_count,
               COALESCE(SUM(e.payment_amount), 0) AS total_revenue
        FROM el_course c
        LEFT JOIN el_enrollment e ON e.course_id = c.id AND e.refunded = false
        WHERE c.status = 'published'
        GROUP BY c.id
        ORDER BY enrollment_count DESC
        LIMIT 5
      `),
      client.query(`
        SELECT c.category,
               COUNT(e.id) AS enrollments,
               COALESCE(SUM(e.payment_amount), 0) AS revenue
        FROM el_course c
        LEFT JOIN el_enrollment e ON e.course_id = c.id AND e.refunded = false
        GROUP BY c.category
        ORDER BY revenue DESC
      `),
      client.query(`
        SELECT c.id, c.title,
               COUNT(e.id) AS total_enrolled,
               COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) AS completed,
               CASE WHEN COUNT(e.id) > 0
                 THEN ROUND(COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(e.id))
                 ELSE 0 END AS completion_rate
        FROM el_course c
        LEFT JOIN el_enrollment e ON e.course_id = c.id AND e.refunded = false
        WHERE c.status = 'published'
        GROUP BY c.id
        ORDER BY completion_rate DESC
        LIMIT 10
      `),
    ]);
    return Response.json({
      enrollment_trend: trend.rows,
      top_courses: topCourses.rows,
      revenue_by_category: revenueByCategory.rows,
      completion_rates: completionRates.rows,
    });
  } finally {
    client.release();
  }
}
