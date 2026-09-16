import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_APPLICATION_TABLE = `
  CREATE TABLE IF NOT EXISTS job_application (
    id SERIAL PRIMARY KEY,
    job_posting_id INT REFERENCES job_posting(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    cover_letter TEXT,
    admin_notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const jobId = searchParams.get('jobId') ?? '';

  const client = await pool.connect();
  try {
    await client.query(CREATE_APPLICATION_TABLE);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (status) {
      conditions.push(`ja.status = $${values.length + 1}`);
      values.push(status);
    }
    if (jobId) {
      conditions.push(`ja.job_posting_id = $${values.length + 1}`);
      values.push(parseInt(jobId, 10));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await client.query(
      `SELECT ja.id, ja.job_posting_id, ja.name, ja.email, ja.phone,
              ja.linkedin_url, ja.portfolio_url, ja.cover_letter,
              ja.admin_notes, ja.status, ja.created_at,
              jp.title AS job_title, jp.department
       FROM job_application ja
       LEFT JOIN job_posting jp ON jp.id = ja.job_posting_id
       ${where}
       ORDER BY ja.created_at DESC`,
      values,
    );

    return Response.json({ applications: result.rows });
  } finally {
    client.release();
  }
}
