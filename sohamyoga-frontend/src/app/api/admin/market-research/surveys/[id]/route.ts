import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const survey = await query(`SELECT id, slug, title, description, type, status, response_count, completion_count FROM survey WHERE id = $1`, [id]);
  if (!survey.rowCount) return Response.json({ error: 'Survey not found.' }, { status: 404 });

  const questions = await query(
    `SELECT id, type, text, is_required, display_order, rating_min, rating_max FROM survey_question WHERE survey_id = $1 ORDER BY display_order`,
    [id],
  );
  const options = await query(
    `SELECT question_id, label, display_order FROM survey_question_option WHERE question_id = ANY($1) ORDER BY display_order`,
    [questions.rows.map(q => q.id)],
  );
  const optionsByQuestion = new Map<string, string[]>();
  for (const o of options.rows) {
    if (!optionsByQuestion.has(o.question_id)) optionsByQuestion.set(o.question_id, []);
    optionsByQuestion.get(o.question_id)!.push(o.label);
  }

  return Response.json({
    ...survey.rows[0],
    questions: questions.rows.map(q => ({ ...q, options: optionsByQuestion.get(q.id) ?? [] })),
  });
}

// Real Survey Lifecycle -- survey.status defaults to 'draft' on create, but
// nothing anywhere could ever move it to 'active', so a created survey could
// never actually be answered (the public respond route requires status=
// active). Same TRANSITIONS-map pattern used elsewhere this session.
const TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['paused', 'closed'],
  paused: ['active', 'closed'],
  closed: ['archived'],
  archived: [],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { status?: string } | null;
  if (!body?.status) return Response.json({ error: 'status is required.' }, { status: 400 });

  const current = await query<{ status: string }>(`SELECT status FROM survey WHERE id = $1`, [id]);
  if (!current.rowCount) return Response.json({ error: 'Survey not found.' }, { status: 404 });

  const allowed = TRANSITIONS[current.rows[0].status] ?? [];
  if (!allowed.includes(body.status)) {
    return Response.json({ error: `Cannot move a "${current.rows[0].status}" survey to "${body.status}".` }, { status: 409 });
  }

  const timestampCol = body.status === 'active' ? 'published_at' : body.status === 'closed' ? 'closed_at' : null;
  await query(
    `UPDATE survey SET status = $2, updated_at = now()${timestampCol ? `, ${timestampCol} = now()` : ''} WHERE id = $1`,
    [id, body.status],
  );
  return Response.json({ ok: true });
}
