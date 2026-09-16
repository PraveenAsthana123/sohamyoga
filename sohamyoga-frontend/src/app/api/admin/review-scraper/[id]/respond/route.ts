import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = params; // job id (used for validation)

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { review_id, response_text } = body;

  if (!review_id || typeof review_id !== 'string') {
    return Response.json({ error: 'review_id is required.' }, { status: 400 });
  }
  if (!response_text || typeof response_text !== 'string' || !(response_text as string).trim()) {
    return Response.json({ error: 'response_text is required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows, rowCount } = await client.query(
      `UPDATE scraped_reviews
       SET is_responded = true, response_text = $2
       WHERE id = $1 AND job_id = $3
       RETURNING *`,
      [review_id, (response_text as string).trim(), id]
    );

    if (!rowCount) {
      return Response.json({ error: 'Review not found or does not belong to this job.' }, { status: 404 });
    }

    return Response.json({ review: rows[0] });
  } catch (err) {
    console.error('[review-scraper/[id]/respond POST]', err);
    return Response.json({ error: 'Failed to save response.' }, { status: 500 });
  } finally {
    client.release();
  }
}
