import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS consensus_item (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        decision_type TEXT DEFAULT 'feature',
        status TEXT DEFAULT 'open',
        proposed_by TEXT,
        options JSONB DEFAULT '[]',
        votes JSONB DEFAULT '{}',
        deadline TIMESTAMPTZ,
        decided_option TEXT,
        decision_rationale TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM consensus_item ORDER BY created_at DESC`,
    ).catch(() => ({ rows: [] }));
    return Response.json({ items: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const body = await req.json() as {
    title: string;
    description?: string;
    decision_type?: string;
    proposed_by?: string;
    options?: { id: string; label: string; description?: string }[];
    deadline?: string;
  };

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO consensus_item (title, description, decision_type, proposed_by, options, deadline)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        body.title,
        body.description ?? null,
        body.decision_type ?? 'feature',
        body.proposed_by ?? null,
        JSON.stringify(body.options ?? []),
        body.deadline ?? null,
      ],
    );
    return Response.json({ item: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json() as {
    id: number;
    status?: string;
    decided_option?: string;
    decision_rationale?: string;
    options?: { id: string; label: string; description?: string }[];
  };

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE consensus_item
       SET status = COALESCE($2, status),
           decided_option = COALESCE($3, decided_option),
           decision_rationale = COALESCE($4, decision_rationale),
           options = COALESCE($5::jsonb, options)
       WHERE id = $1
       RETURNING *`,
      [
        body.id,
        body.status ?? null,
        body.decided_option ?? null,
        body.decision_rationale ?? null,
        body.options ? JSON.stringify(body.options) : null,
      ],
    );
    if (result.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ item: result.rows[0] });
  } finally {
    client.release();
  }
}
