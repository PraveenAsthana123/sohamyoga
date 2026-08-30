// PATCH — human toggles a Manual Process checklist/todo-list item.
// POST — human appends a new custom checklist item (in addition to the
// real phase-specific template items + the 4 generic workflow-gate items
// already seeded at study creation). Both write to phase_run + a real
// timestamped phase_run_transaction entry (policy §3: "every entry with a
// real date+time stamp").

import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../../../../lib/session-auth';
import { query } from '../../../../../../../lib/postgres';
import { getPhaseRunByStudyAndSlug, appendTransaction } from '../../../../../../../domain/pipeline/PipelineService';

export async function PATCH(req: NextRequest, { params }: { params: { studyId: string; phaseSlug: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { field?: 'checklist' | 'todoList'; index?: number; done?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.field || !['checklist', 'todoList'].includes(body.field) || typeof body.index !== 'number' || typeof body.done !== 'boolean') {
    return Response.json({ error: 'field (checklist|todoList), index, and done are required.' }, { status: 400 });
  }

  const detail = await getPhaseRunByStudyAndSlug(params.studyId, params.phaseSlug);
  if (!detail) return Response.json({ error: 'Phase run not found.' }, { status: 404 });

  const column = body.field === 'checklist' ? 'checklist' : 'todo_list';
  const list = body.field === 'checklist' ? detail.phaseRun.checklist : detail.phaseRun.todoList;
  if (body.index < 0 || body.index >= list.length) {
    return Response.json({ error: 'index out of range.' }, { status: 400 });
  }
  const updated = list.map((item: any, i: number) => (i === body.index ? { ...item, done: body!.done } : item));

  await query(`UPDATE phase_run SET ${column} = $1, updated_at = now() WHERE id = $2`, [JSON.stringify(updated), detail.phaseRun.id]);
  await appendTransaction(
    detail.phaseRun.id,
    'manual_checklist_update',
    `Human marked ${body.field} item ${body.index + 1} ("${list[body.index].text}") as ${body.done ? 'done' : 'not done'}.`,
  );

  return Response.json({ ok: true, [body.field]: updated });
}

export async function POST(req: NextRequest, { params }: { params: { studyId: string; phaseSlug: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text) {
    return Response.json({ error: 'text is required.' }, { status: 400 });
  }

  const detail = await getPhaseRunByStudyAndSlug(params.studyId, params.phaseSlug);
  if (!detail) return Response.json({ error: 'Phase run not found.' }, { status: 404 });

  const updated = [...detail.phaseRun.checklist, { text, done: false }];

  await query(`UPDATE phase_run SET checklist = $1, updated_at = now() WHERE id = $2`, [JSON.stringify(updated), detail.phaseRun.id]);
  await appendTransaction(
    detail.phaseRun.id,
    'manual_checklist_add',
    `Human added a new checklist item: "${text}".`,
  );

  return Response.json({ ok: true, checklist: updated }, { status: 201 });
}
