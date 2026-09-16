import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_JOB_POSTING = `
  CREATE TABLE IF NOT EXISTS job_posting (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    department TEXT DEFAULT 'General',
    location TEXT DEFAULT 'Remote',
    employment_type TEXT DEFAULT 'full-time',
    salary_range TEXT,
    summary TEXT,
    description TEXT,
    requirements TEXT,
    nice_to_have TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

// Public: list active jobs
export async function GET(_req: NextRequest) {
  const client = await pool.connect();
  try {
    await client.query(CREATE_JOB_POSTING);

    const result = await client.query(`
      SELECT id, title, slug, department, location, employment_type, salary_range,
             summary, is_active, sort_order, created_at, updated_at
      FROM job_posting
      WHERE is_active = true
      ORDER BY sort_order ASC, created_at DESC
    `);

    return Response.json({ jobs: result.rows });
  } finally {
    client.release();
  }
}

// Admin: create a job posting
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = (await req.json()) as {
    title: string;
    slug: string;
    department?: string;
    location?: string;
    employment_type?: string;
    salary_range?: string;
    summary?: string;
    description?: string;
    requirements?: string;
    nice_to_have?: string;
    is_active?: boolean;
    sort_order?: number;
  };

  if (!body.title?.trim() || !body.slug?.trim()) {
    return Response.json({ error: 'title and slug are required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query(CREATE_JOB_POSTING);

    const result = await client.query(
      `INSERT INTO job_posting
         (title, slug, department, location, employment_type, salary_range, summary,
          description, requirements, nice_to_have, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        body.title.trim(),
        body.slug.trim(),
        body.department ?? 'General',
        body.location ?? 'Remote',
        body.employment_type ?? 'full-time',
        body.salary_range ?? null,
        body.summary ?? null,
        body.description ?? null,
        body.requirements ?? null,
        body.nice_to_have ?? null,
        body.is_active ?? true,
        body.sort_order ?? 0,
      ],
    );

    return Response.json({ job: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
