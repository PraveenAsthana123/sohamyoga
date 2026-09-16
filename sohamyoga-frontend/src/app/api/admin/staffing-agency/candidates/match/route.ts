import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { job_order_id } = await req.json();
    if (!job_order_id) return NextResponse.json({ error: 'job_order_id required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const jobRes = await client.query(`SELECT * FROM sa_job_order WHERE id=$1`, [job_order_id]);
      if (!jobRes.rows.length) return NextResponse.json({ error: 'Job order not found' }, { status: 404 });
      const job = jobRes.rows[0];
      const requiredSkills: string[] = job.required_skills || [];
      // Match: active candidates, salary overlap, work auth compatible
      const { rows: candidates } = await client.query(`
        SELECT c.*,
          (SELECT COUNT(*) FROM unnest(c.skills) s WHERE s = ANY($1::text[])) AS matched_skills_count,
          CARDINALITY($1::text[]) AS required_skills_count
        FROM sa_candidate c
        WHERE c.status = 'active'
          AND (c.desired_salary_min IS NULL OR c.desired_salary_min <= $2 OR $2 IS NULL)
          AND c.work_authorization IN ('canadian_citizen','permanent_resident','open_work_permit')
        ORDER BY matched_skills_count DESC, c.years_experience DESC
        LIMIT 20
      `, [requiredSkills, job.salary_max]);

      const ranked = candidates.map(c => ({
        ...c,
        match_pct: requiredSkills.length > 0
          ? Math.min(100, Math.round(parseInt(c.matched_skills_count)/requiredSkills.length*100))
          : 0,
      })).sort((a, b) => b.match_pct - a.match_pct);
      return NextResponse.json({ job_order: job, matches: ranked });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
