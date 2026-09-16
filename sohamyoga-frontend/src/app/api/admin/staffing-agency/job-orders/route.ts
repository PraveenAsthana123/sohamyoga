import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get('client');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT j.*, c.company_name, (SELECT COUNT(*) FROM sa_submission s WHERE s.job_order_id=j.id) AS submission_count FROM sa_job_order j JOIN sa_client_company c ON c.id=j.client_company_id WHERE 1=1`;
      const params: any[] = [];
      if (client_id) { params.push(parseInt(client_id)); q += ` AND j.client_company_id=$${params.length}`; }
      if (status) { params.push(status); q += ` AND j.status=$${params.length}`; }
      if (type) { params.push(type); q += ` AND j.job_type=$${params.length}`; }
      if (priority) { params.push(priority); q += ` AND j.priority=$${params.length}`; }
      q += ` ORDER BY CASE j.priority WHEN 'exclusive' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, j.created_at DESC`;
      const { rows } = await client.query(q, params);
      return NextResponse.json(rows);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO sa_job_order (client_company_id, job_title, department, job_type, salary_min, salary_max, work_location, city, province, required_skills, preferred_skills, required_certifications, years_experience_min, education_requirement, job_description, priority, status, assigned_recruiter, target_start_date, fee_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [body.client_company_id, body.job_title, body.department||null, body.job_type||'permanent', body.salary_min||null, body.salary_max||null, body.work_location||'hybrid', body.city||'Calgary', body.province||'AB', body.required_skills||[], body.preferred_skills||[], body.required_certifications||[], body.years_experience_min||0, body.education_requirement||null, body.job_description||null, body.priority||'medium', body.status||'active', body.assigned_recruiter||null, body.target_start_date||null, body.fee_amount||null]
      );
      // Update active_job_orders count on client company
      await client.query(`UPDATE sa_client_company SET active_job_orders=(SELECT COUNT(*) FROM sa_job_order WHERE client_company_id=$1 AND status='active') WHERE id=$1`, [body.client_company_id]);
      return NextResponse.json(rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
