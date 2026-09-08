import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Research Question Table -- "Screen 03: Research Objective & Question
// Builder" from the Market Research Control Tower blueprint. Real ordered
// list of questions belonging to a real research project.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const rows = await query<{ id: string; question_text: string; sort_order: number; created_at: string }>(
    `SELECT id, question_text, sort_order, created_at FROM research_question WHERE project_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [id],
  );
  return Response.json({
    questions: rows.rows.map(r => ({ id: r.id, questionText: r.question_text, sortOrder: r.sort_order, createdAt: r.created_at })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { questionText?: string } | null;
  if (!body?.questionText?.trim()) return Response.json({ error: 'questionText is required.' }, { status: 400 });

  const project = await query<{ id: string }>(`SELECT id FROM research_project WHERE id = $1`, [id]);
  if (!project.rowCount) return Response.json({ error: 'Project not found.' }, { status: 404 });

  const count = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM research_question WHERE project_id = $1`, [id]);
  const result = await query<{ id: string }>(
    `INSERT INTO research_question (project_id, question_text, sort_order) VALUES ($1,$2,$3) RETURNING id`,
    [id, body.questionText.trim(), Number(count.rows[0].n)],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
