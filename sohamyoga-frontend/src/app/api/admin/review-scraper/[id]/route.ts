import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: jobs } = await client.query(
      `SELECT * FROM review_scrape_jobs WHERE id = $1`,
      [id]
    );
    if (!jobs.length) return Response.json({ error: 'Job not found.' }, { status: 404 });

    const { rows: reviews } = await client.query(
      `SELECT * FROM scraped_reviews WHERE job_id = $1 ORDER BY scraped_at DESC`,
      [id]
    );

    return Response.json({ job: jobs[0], reviews });
  } catch (err) {
    console.error('[review-scraper/[id] GET]', err);
    return Response.json({ error: 'Failed to load job.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const allowed = ['business_name', 'business_url', 'place_id', 'schedule', 'is_competitor'];
  const sets: string[] = [];
  const values: unknown[] = [];
  let pIdx = 1;

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${pIdx++}`);
      values.push(body[key]);
    }
  }

  if (!sets.length) return Response.json({ error: 'No updatable fields provided.' }, { status: 400 });

  values.push(id);
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE review_scrape_jobs SET ${sets.join(', ')} WHERE id = $${pIdx} RETURNING *`,
      values
    );
    if (!rows.length) return Response.json({ error: 'Job not found.' }, { status: 404 });
    return Response.json({ job: rows[0] });
  } catch (err) {
    console.error('[review-scraper/[id] PATCH]', err);
    return Response.json({ error: 'Failed to update job.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `DELETE FROM review_scrape_jobs WHERE id = $1`,
      [id]
    );
    if (!rowCount) return Response.json({ error: 'Job not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[review-scraper/[id] DELETE]', err);
    return Response.json({ error: 'Failed to delete job.' }, { status: 500 });
  } finally {
    client.release();
  }
}
