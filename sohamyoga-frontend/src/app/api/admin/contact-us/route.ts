import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_submission (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200),
      email VARCHAR(200),
      phone VARCHAR(50),
      subject VARCHAR(300),
      message TEXT,
      source VARCHAR(50) DEFAULT 'website',
      status VARCHAR(20) DEFAULT 'new',
      assigned_to VARCHAR(100),
      reply_text TEXT,
      replied_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const resource = searchParams.get('resource') || 'submissions';
  const status = searchParams.get('status') || '';

  if (resource === 'analytics') {
    const [daily, bySource, avgResponse] = await Promise.all([
      pool.query(`
        SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*)::int AS count
        FROM contact_submission
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day DESC
      `),
      pool.query(`
        SELECT source, COUNT(*)::int AS count FROM contact_submission GROUP BY source ORDER BY count DESC
      `),
      pool.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (replied_at - created_at)) / 3600)::numeric(10,2) AS avg_hours
        FROM contact_submission WHERE replied_at IS NOT NULL
      `),
    ]);
    return NextResponse.json({
      daily: daily.rows,
      bySource: bySource.rows,
      avgResponseHours: avgResponse.rows[0]?.avg_hours ?? null,
    });
  }

  const whereClause = status ? `WHERE status = $1` : '';
  const params = status ? [status] : [];
  const result = await pool.query(
    `SELECT * FROM contact_submission ${whereClause} ORDER BY created_at DESC LIMIT 200`,
    params,
  );
  return NextResponse.json({ submissions: result.rows });
}

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json().catch(() => null) as {
    name?: string; email?: string; phone?: string; subject?: string;
    message?: string; source?: string;
  } | null;

  if (!body?.email?.trim()) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO contact_submission (name, email, phone, subject, message, source)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [body.name, body.email, body.phone, body.subject, body.message, body.source ?? 'website'],
  );
  return NextResponse.json({ submission: result.rows[0] }, { status: 201 });
}
