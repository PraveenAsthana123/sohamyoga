import { NextRequest } from 'next/server';
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

// Public: submit a job application
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const jobId = parseInt(id, 10);
  if (isNaN(jobId)) {
    return Response.json({ error: 'Invalid job id' }, { status: 400 });
  }

  const body = (await req.json()) as {
    name: string;
    email: string;
    phone?: string;
    linkedin_url?: string;
    portfolio_url?: string;
    cover_letter?: string;
  };

  if (!body.name?.trim() || !body.email?.trim()) {
    return Response.json({ error: 'name and email are required' }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query(CREATE_APPLICATION_TABLE);

    // Verify the job exists and is active
    const jobCheck = await client.query(
      `SELECT id FROM job_posting WHERE id = $1 AND is_active = true`,
      [jobId],
    );
    if (!jobCheck.rows.length) {
      return Response.json({ error: 'Job not found or no longer accepting applications' }, { status: 404 });
    }

    const result = await client.query(
      `INSERT INTO job_application
         (job_posting_id, name, email, phone, linkedin_url, portfolio_url, cover_letter)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, job_posting_id, name, email, status, created_at`,
      [
        jobId,
        body.name.trim(),
        body.email.trim().toLowerCase(),
        body.phone?.trim() ?? null,
        body.linkedin_url?.trim() ?? null,
        body.portfolio_url?.trim() ?? null,
        body.cover_letter?.trim() ?? null,
      ],
    );

    return Response.json({ application: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
