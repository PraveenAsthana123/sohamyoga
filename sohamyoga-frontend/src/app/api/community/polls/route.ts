import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getCustomerPrincipal } from '@/lib/customer-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — any authenticated customer or admin can list active polls + live vote counts.
export async function GET(req: NextRequest) {
  const admin = await getAdminPrincipal(req);
  const customer = admin.principal ? null : await getCustomerPrincipal(req);
  if (!admin.principal && !customer?.principal) return admin.denied ?? customer?.denied ?? Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const polls = await query<{ id: string; question: string; status: string; allow_multiple_votes: boolean; show_results_before_close: boolean; ends_at: string | null; created_at: string }>(
    `SELECT id, question, status::text, allow_multiple_votes, show_results_before_close, ends_at, created_at
     FROM poll WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId],
  );

  const results = await Promise.all(polls.rows.map(async p => {
    const options = await query<{ id: string; text: string; votes: string }>(
      `SELECT po.id, po.text, count(pv.id)::text AS votes
       FROM poll_option po LEFT JOIN poll_vote pv ON pv.poll_option_id = po.id
       WHERE po.poll_id = $1 GROUP BY po.id ORDER BY po.sort_order`,
      [p.id],
    );
    const voterId = customer?.principal?.id;
    const votedRows = voterId
      ? await query<{ poll_option_id: string }>(
          `SELECT pv.poll_option_id FROM poll_vote pv JOIN poll_option po ON po.id = pv.poll_option_id WHERE po.poll_id = $1 AND pv.voter_user_id = $2`,
          [p.id, voterId],
        )
      : { rows: [] as Array<{ poll_option_id: string }> };
    return {
      id: p.id, question: p.question, status: p.status, allowMultipleVotes: p.allow_multiple_votes,
      showResultsBeforeClose: p.show_results_before_close, endsAt: p.ends_at, createdAt: p.created_at,
      options: options.rows.map(o => ({ id: o.id, text: o.text, votes: Number(o.votes) })),
      hasVoted: votedRows.rows.length > 0,
      votedOptionIds: votedRows.rows.map(r => r.poll_option_id),
    };
  }));

  return Response.json({ polls: results });
}

// POST — admin creates a poll with options.
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    question?: string; options?: string[]; allowMultipleVotes?: boolean; showResultsBeforeClose?: boolean; endsAt?: string;
  } | null;
  if (!body?.question?.trim()) return Response.json({ error: 'question is required.' }, { status: 400 });
  const options = (body.options ?? []).map(o => o.trim()).filter(Boolean);
  if (options.length < 2) return Response.json({ error: 'At least 2 options are required.' }, { status: 400 });
  if (new Set(options).size !== options.length) return Response.json({ error: 'Poll options must be unique.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const pollResult = await query<{ id: string }>(
    `INSERT INTO poll (tenant_id, created_by_id, question, status, allow_multiple_votes, show_results_before_close, ends_at)
     VALUES ($1,$2,$3,'DRAFT',$4,$5,$6) RETURNING id`,
    [tenantId, principal!.id, body.question.trim(), body.allowMultipleVotes ?? false, body.showResultsBeforeClose ?? true, body.endsAt ?? null],
  );
  const pollId = pollResult.rows[0].id;

  for (let i = 0; i < options.length; i++) {
    await query(`INSERT INTO poll_option (poll_id, text, sort_order) VALUES ($1, $2, $3)`, [pollId, options[i], i]);
  }

  return Response.json({ ok: true, id: pollId }, { status: 201 });
}
