import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const { id } = await Promise.resolve(params);
  const rows = await query(
    `SELECT id, survey_id, question_text, question_type, options, required, sort_order, logic_rules, created_at
     FROM survey_question WHERE survey_id = $1 ORDER BY sort_order, id`,
    [id]
  );
  return Response.json({ questions: rows.rows });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const { id } = await Promise.resolve(params);
  const body = await req.json() as {
    question_text: string;
    question_type?: string;
    options?: unknown[];
    required?: boolean;
    sort_order?: number;
    logic_rules?: unknown;
  };

  // Ensure tables exist
  await query(`CREATE TABLE IF NOT EXISTS survey_question (
    id SERIAL PRIMARY KEY,
    survey_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30),
    options JSONB DEFAULT '[]',
    required BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    logic_rules JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`, []);

  const row = await query(
    `INSERT INTO survey_question (survey_id, question_text, question_type, options, required, sort_order, logic_rules)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      id,
      body.question_text,
      body.question_type ?? 'text',
      JSON.stringify(body.options ?? []),
      body.required !== false,
      body.sort_order ?? 0,
      JSON.stringify(body.logic_rules ?? {}),
    ]
  );
  return Response.json({ question: row.rows[0] }, { status: 201 });
}
