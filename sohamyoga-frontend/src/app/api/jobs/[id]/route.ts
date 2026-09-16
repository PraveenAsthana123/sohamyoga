import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: public — fetch a single job by id or slug
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    const isNumeric = /^\d+$/.test(id);
    const result = await client.query(
      isNumeric
        ? `SELECT * FROM job_posting WHERE id = $1`
        : `SELECT * FROM job_posting WHERE slug = $1`,
      [isNumeric ? parseInt(id, 10) : id],
    );

    if (!result.rows.length) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    return Response.json({ job: result.rows[0] });
  } finally {
    client.release();
  }
}

// PUT: admin — update a job posting
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json()) as {
    title?: string;
    slug?: string;
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

  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const values: unknown[] = [];

    const allowed = [
      'title','slug','department','location','employment_type','salary_range',
      'summary','description','requirements','nice_to_have','is_active','sort_order',
    ] as const;

    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = $${values.length + 1}`);
        values.push(body[key]);
      }
    }

    if (!fields.length) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(parseInt(id, 10));

    const result = await client.query(
      `UPDATE job_posting SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!result.rows.length) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    return Response.json({ job: result.rows[0] });
  } finally {
    client.release();
  }
}

// DELETE: admin — remove a job posting
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM job_posting WHERE id = $1 RETURNING id`,
      [parseInt(id, 10)],
    );

    if (!result.rows.length) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    return Response.json({ deleted: true, id: result.rows[0].id });
  } finally {
    client.release();
  }
}
