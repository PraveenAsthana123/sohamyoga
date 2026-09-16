import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS ml_model_run (
    id SERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_type TEXT,
    run_type TEXT DEFAULT 'inference',
    status TEXT DEFAULT 'completed',
    accuracy NUMERIC,
    loss NUMERIC,
    epochs INTEGER,
    training_samples INTEGER,
    inference_count INTEGER DEFAULT 0,
    duration_ms INTEGER,
    parameters JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const model_type = searchParams.get('model_type');
  const run_type = searchParams.get('run_type');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (model_type) { conditions.push(`model_type = $${idx++}`); values.push(model_type); }
  if (run_type) { conditions.push(`run_type = $${idx++}`); values.push(run_type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM ml_model_run ${where} ORDER BY created_at DESC LIMIT 500`,
    values
  );
  return Response.json({ runs: rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.model_name) return Response.json({ error: 'model_name is required' }, { status: 400 });
  const { rows } = await pool.query(
    `INSERT INTO ml_model_run (model_name, model_type, run_type, status, accuracy, loss, epochs, training_samples, inference_count, duration_ms, parameters, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [b.model_name, b.model_type || null, b.run_type || 'inference', b.status || 'completed',
     b.accuracy ?? null, b.loss ?? null, b.epochs ?? null, b.training_samples ?? null,
     b.inference_count ?? 0, b.duration_ms ?? null,
     b.parameters ? JSON.stringify(b.parameters) : null, b.notes || null]
  );
  return Response.json({ run: rows[0] }, { status: 201 });
}
