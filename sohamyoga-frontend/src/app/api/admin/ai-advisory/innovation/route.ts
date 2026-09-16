export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS innovation_lab_ideas (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        submitter TEXT,
        category TEXT,
        description TEXT,
        feasibility TEXT DEFAULT 'medium',
        impact TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'backlog',
        votes INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM innovation_lab_ideas`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO innovation_lab_ideas (title, submitter, category, description, feasibility, impact, status, votes) VALUES
        ('AI-Powered Yoga Pose Feedback via Webcam', 'Product Team', 'computer_vision', 'Use MediaPipe + LLM to analyze student yoga poses in real-time and give corrective feedback', 'medium', 'high', 'selected', 24),
        ('Personalized Class Recommendation Engine', 'Marketing', 'recommendation', 'Suggest next best class/instructor based on past attendance, goals, and preferences', 'high', 'high', 'in_progress', 31),
        ('AI Chatbot for Ayurvedic Wellness Guidance', 'Content Team', 'nlp', 'RAG chatbot grounded in Ayurvedic texts to answer wellness questions and recommend practices', 'medium', 'medium', 'backlog', 12),
        ('Automatic Marketing Copy from Class Schedule', 'Marketing', 'generation', 'Auto-generate Instagram captions, email subject lines, and blog intros from class schedule data', 'high', 'medium', 'completed', 19),
        ('AI Pricing Optimizer for Peak Hours', 'Revenue', 'optimization', 'Dynamic pricing for class slots based on demand forecasting — increase revenue by 15-20%', 'medium', 'high', 'backlog', 8),
        ('Voice-to-Cue: AI Yoga Instructor Script Generator', 'Instructor Team', 'generation', 'Instructors describe a class theme; AI generates a full cueing script with breathing cues', 'high', 'medium', 'backlog', 15),
        ('Sentiment Analysis on Student Feedback', 'Operations', 'nlp', 'Automatically classify and prioritize student reviews and feedback forms using sentiment analysis', 'high', 'low', 'selected', 7),
        ('AI-Generated Quarterly Business Narratives', 'Finance', 'generation', 'Auto-generate executive narrative summaries from monthly financial and operational KPIs', 'high', 'medium', 'backlog', 11)
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM innovation_lab_ideas ORDER BY votes DESC, created_at DESC`);
    return Response.json({ ideas: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();

  const body = await req.json();
  const { title, submitter, category, description, feasibility, impact, vote_id } = body;

  // Handle upvote
  if (vote_id) {
    const pool2 = getPool();
    const c2 = await pool2.connect();
    try {
      const { rows } = await c2.query(`UPDATE innovation_lab_ideas SET votes=votes+1 WHERE id=$1 RETURNING *`, [vote_id]);
      return Response.json({ idea: rows[0] });
    } finally {
      c2.release();
    }
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO innovation_lab_ideas (title, submitter, category, description, feasibility, impact)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, submitter, category, description, feasibility ?? 'medium', impact ?? 'medium']
    );
    return Response.json({ idea: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
