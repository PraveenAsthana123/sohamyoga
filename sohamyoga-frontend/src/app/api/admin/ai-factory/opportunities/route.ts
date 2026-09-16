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
      CREATE TABLE IF NOT EXISTS ai_opportunities (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        department TEXT,
        current_process TEXT,
        ai_solution TEXT,
        effort TEXT DEFAULT 'medium',
        impact TEXT DEFAULT 'high',
        status TEXT DEFAULT 'identified',
        roi_estimate NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM ai_opportunities`);
    if (rows[0].cnt === 0) {
      await client.query(`
        INSERT INTO ai_opportunities (title, department, current_process, ai_solution, effort, impact, status, roi_estimate) VALUES
        ('Automate Class Description Writing', 'Marketing', 'Instructors write descriptions manually — 1h per class', 'llama3.2 generates description from class name + style + instructor bio in <30s', 'low', 'medium', 'approved', 120),
        ('AI-Powered Lead Response Emails', 'Sales', 'SDR writes personalized outreach emails — 20min per lead', 'AI generates personalized email from lead data; SDR reviews and sends', 'low', 'high', 'in_progress', 280),
        ('Automated Monthly Performance Reports', 'Operations', 'Analyst compiles KPIs from 5 sources into Word doc — 6h/month', 'AI aggregates KPIs and writes executive narrative automatically', 'medium', 'high', 'identified', 180),
        ('AI Invoice Data Extraction', 'Finance', 'Accountant manually keys vendor invoices — 3h/week', 'OCR + LLM extracts structured data from PDF invoices into accounting system', 'medium', 'medium', 'identified', 90),
        ('Smart Customer Segmentation', 'Marketing', 'Marketing analyst manually segments customers quarterly', 'ML model continuously clusters customers by behavior and value', 'high', 'high', 'approved', 350)
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
    const { rows } = await client.query(`SELECT * FROM ai_opportunities ORDER BY roi_estimate DESC`);
    return Response.json({ opportunities: rows });
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
  const { title, department, current_process, ai_solution, effort, impact, roi_estimate } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ai_opportunities (title, department, current_process, ai_solution, effort, impact, roi_estimate)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, department, current_process, ai_solution, effort ?? 'medium', impact ?? 'high', roi_estimate ?? 0]
    );
    return Response.json({ opportunity: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
