import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRANSITIONS: Record<string, string[]> = {
  qualification: ['needs_analysis', 'closed_lost'],
  needs_analysis: ['proposal', 'closed_lost'],
  proposal: ['negotiation', 'closed_lost'],
  negotiation: ['closed_won', 'closed_lost'],
  closed_won: [],
  closed_lost: [],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { stage?: string; lostReason?: string } | null;
  if (!body?.stage) return Response.json({ error: 'stage is required.' }, { status: 400 });

  const current = await query<{ stage: string }>(`SELECT stage FROM opportunity WHERE id = $1`, [id]);
  if (!current.rowCount) return Response.json({ error: 'Opportunity not found.' }, { status: 404 });

  const allowed = TRANSITIONS[current.rows[0].stage] ?? [];
  if (!allowed.includes(body.stage)) {
    return Response.json({ error: `Cannot move a "${current.rows[0].stage}" opportunity to "${body.stage}".` }, { status: 409 });
  }
  if (body.stage === 'closed_lost' && !body.lostReason?.trim()) {
    return Response.json({ error: 'lostReason is required when closing an opportunity as lost.' }, { status: 400 });
  }

  const isClosing = body.stage === 'closed_won' || body.stage === 'closed_lost';
  await query(
    `UPDATE opportunity SET stage = $2, updated_at = now(), lost_reason = COALESCE($3, lost_reason)${isClosing ? ', closed_at = now()' : ''} WHERE id = $1`,
    [id, body.stage, body.lostReason ?? null],
  );
  return Response.json({ ok: true });
}
