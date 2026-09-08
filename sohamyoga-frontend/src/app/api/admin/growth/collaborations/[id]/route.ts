import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRANSITIONS: Record<string, string[]> = {
  identified: ['contacted', 'declined'],
  contacted: ['negotiating', 'declined'],
  negotiating: ['active', 'declined'],
  active: ['completed', 'declined'],
  completed: [],
  declined: [],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { status?: string; submittedContentUrl?: string; publishedContentUrl?: string } | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const current = await query<{ status: string }>(`SELECT status FROM influencer_collaboration WHERE id = $1`, [id]);
  if (!current.rowCount) return Response.json({ error: 'Collaboration not found.' }, { status: 404 });

  // Content Submission Screen: the influencer's deliverable link, recordable
  // at any stage prior to going live -- independent of the status machine.
  if (body.submittedContentUrl !== undefined) {
    await query(
      `UPDATE influencer_collaboration SET submitted_content_url = $2, submitted_at = now(), updated_at = now() WHERE id = $1`,
      [id, body.submittedContentUrl],
    );
  }

  // Publishing Screen: proof the content actually went live -- only
  // meaningful once (or as) the collaboration reaches 'active'.
  if (body.publishedContentUrl !== undefined) {
    await query(
      `UPDATE influencer_collaboration SET published_content_url = $2, published_at = now(), updated_at = now() WHERE id = $1`,
      [id, body.publishedContentUrl],
    );
  }

  if (body.status !== undefined) {
    const allowed = TRANSITIONS[current.rows[0].status] ?? [];
    if (!allowed.includes(body.status)) {
      return Response.json({ error: `Cannot move a "${current.rows[0].status}" collaboration to "${body.status}".` }, { status: 409 });
    }

    const timestampCol = body.status === 'active' ? 'started_at' : body.status === 'completed' ? 'completed_at' : null;
    await query(
      `UPDATE influencer_collaboration SET status = $2, updated_at = now()${timestampCol ? `, ${timestampCol} = now()` : ''} WHERE id = $1`,
      [id, body.status],
    );
  }

  return Response.json({ ok: true });
}
