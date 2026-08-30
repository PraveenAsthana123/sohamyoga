import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getCustomerPrincipal } from '@/lib/customer-auth';
import { Poll, type PollProps } from '@/domain/community/Poll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST — real vote, validated through Poll.ts's own vote() logic (active-only,
// single-vote-unless-allowed), then persisted with a DB UNIQUE constraint
// (poll_option/voter) as a second, storage-level guard against duplicate votes.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getCustomerPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { optionId?: string } | null;
  if (!body?.optionId) return Response.json({ error: 'optionId is required.' }, { status: 400 });

  const pollRow = await query<{
    id: string; created_by_id: string; question: string; status: string; allow_multiple_votes: boolean;
    show_results_before_close: boolean; ends_at: string | null; target_segment: string; created_at: string;
  }>(`SELECT * FROM poll WHERE id = $1`, [params.id]);
  if (!pollRow.rows.length) return Response.json({ error: 'Poll not found.' }, { status: 404 });

  const options = await query<{ id: string; text: string }>(`SELECT id, text FROM poll_option WHERE poll_id = $1`, [params.id]);
  if (!options.rows.some(o => o.id === body.optionId)) return Response.json({ error: 'Invalid optionId for this poll.' }, { status: 400 });

  const existingVotes = await query<{ poll_option_id: string }>(
    `SELECT pv.poll_option_id FROM poll_vote pv JOIN poll_option po ON po.id = pv.poll_option_id WHERE po.poll_id = $1 AND pv.voter_user_id = $2`,
    [params.id, principal!.id],
  );

  const p = pollRow.rows[0];
  const props: PollProps = {
    id: p.id, createdById: p.created_by_id, question: p.question, status: p.status as PollProps['status'],
    allowMultipleVotes: p.allow_multiple_votes, showResultsBeforeClose: p.show_results_before_close,
    endsAt: p.ends_at ? new Date(p.ends_at) : undefined, createdAt: new Date(p.created_at),
    targetSegment: p.target_segment as PollProps['targetSegment'],
    options: options.rows.map(o => ({ id: o.id, text: o.text, votes: existingVotes.rows.some(v => v.poll_option_id === o.id) ? [principal!.id] : [] })),
  };

  try {
    new Poll(props).vote(principal!.id, body.optionId);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Vote rejected.' }, { status: 422 });
  }

  try {
    await query(`INSERT INTO poll_vote (poll_option_id, voter_user_id) VALUES ($1, $2)`, [body.optionId, principal!.id]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('duplicate key')) return Response.json({ error: 'You have already voted on this option.' }, { status: 409 });
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({ ok: true });
}
