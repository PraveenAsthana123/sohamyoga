export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import type { PoolClient } from 'pg';
import { requireAdmin } from '@/lib/admin-auth';

async function ensureSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS process_step (
      id SERIAL PRIMARY KEY,
      process_id INTEGER REFERENCES business_process(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      description TEXT,
      responsible_role TEXT,
      tool TEXT,
      estimated_minutes INTEGER,
      is_automated BOOLEAN DEFAULT false,
      decision_point BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const processId = parseInt(params.id, 10);
  if (isNaN(processId)) return Response.json({ error: 'Invalid process id' }, { status: 400 });

  const client = await getPool().connect();
  try {
    await ensureSchema(client);
    const result = await client.query(
      `SELECT * FROM process_step WHERE process_id = $1 ORDER BY step_order`,
      [processId]
    );
    return Response.json({ steps: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const processId = parseInt(params.id, 10);
  if (isNaN(processId)) return Response.json({ error: 'Invalid process id' }, { status: 400 });

  const body = await req.json() as Record<string, unknown>;
  const { step_order, step_name, description, responsible_role, tool,
    estimated_minutes, is_automated, decision_point } = body;

  if (!step_name || step_order === undefined) {
    return Response.json({ error: 'step_name and step_order are required' }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await ensureSchema(client);
    const result = await client.query(`
      INSERT INTO process_step
        (process_id, step_order, step_name, description, responsible_role, tool,
         estimated_minutes, is_automated, decision_point)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [processId, step_order, step_name, description || null, responsible_role || null,
        tool || null, estimated_minutes || null, is_automated || false, decision_point || false]);
    return Response.json({ step: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
