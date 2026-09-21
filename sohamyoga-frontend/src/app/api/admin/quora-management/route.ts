import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ answers: [], questions: [], summary: { totalAnswers: 0, totalViews: 0, totalUpvotes: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS quora_answer (
        id SERIAL PRIMARY KEY,
        question TEXT,
        answer_text TEXT,
        topic TEXT,
        views INTEGER DEFAULT 0,
        upvotes INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS quora_question (
        id SERIAL PRIMARY KEY,
        question_text TEXT,
        topic TEXT,
        search_volume INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [answersRes, questionsRes] = await Promise.all([
      client.query(`SELECT * FROM quora_answer ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM quora_question ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
    ]);

    const answers: Array<{ views: number; upvotes: number }> = answersRes.rows;
    const summary = {
      totalAnswers: answers.length,
      totalViews: answers.reduce((s, r) => s + Number(r.views ?? 0), 0),
      totalUpvotes: answers.reduce((s, r) => s + Number(r.upvotes ?? 0), 0),
    };

    return Response.json({ answers: answersRes.rows, questions: questionsRes.rows, summary });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.type === 'question') {
      const result = await client.query(
        `INSERT INTO quora_question (question_text, topic, search_volume) VALUES ($1,$2,$3) RETURNING *`,
        [body.question_text ?? '', body.topic ?? '', body.search_volume ?? 0]
      );
      return Response.json({ question: result.rows[0] }, { status: 201 });
    } else {
      const result = await client.query(
        `INSERT INTO quora_answer (question, answer_text, topic, status) VALUES ($1,$2,$3,$4) RETURNING *`,
        [body.question ?? '', body.answer_text ?? '', body.topic ?? '', body.status ?? 'draft']
      );
      return Response.json({ answer: result.rows[0] }, { status: 201 });
    }
  } finally {
    client.release();
  }
}
