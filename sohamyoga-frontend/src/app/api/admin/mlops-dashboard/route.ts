import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ models: [], metrics: [], summary: { totalModels: 0, championModels: 0, driftAlerts: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ml_model (
        id SERIAL PRIMARY KEY,
        model_name TEXT NOT NULL,
        model_type TEXT,
        version TEXT,
        accuracy NUMERIC(5,4),
        f1_score NUMERIC(5,4),
        training_date DATE,
        last_evaluated DATE,
        drift_score NUMERIC(5,4) DEFAULT 0,
        status TEXT DEFAULT 'staging',
        champion BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS model_metric (
        id SERIAL PRIMARY KEY,
        model_id INTEGER REFERENCES ml_model(id) ON DELETE CASCADE,
        metric_name TEXT,
        metric_value NUMERIC(12,6),
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [modelsRes, metricsRes] = await Promise.all([
      client.query(`SELECT * FROM ml_model ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT mm.*, m.model_name FROM model_metric mm LEFT JOIN ml_model m ON m.id = mm.model_id ORDER BY mm.recorded_at DESC LIMIT 200`).catch(() => ({ rows: [] })),
    ]);

    const models: Array<{ champion: boolean; drift_score: number }> = modelsRes.rows;
    const summary = {
      totalModels: models.length,
      championModels: models.filter(m => m.champion).length,
      driftAlerts: models.filter(m => Number(m.drift_score ?? 0) > 0.1).length,
    };

    return Response.json({ models: modelsRes.rows, metrics: metricsRes.rows, summary });
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
    if (body.action === 'set_champion' && body.model_id) {
      await client.query(`UPDATE ml_model SET champion = false`);
      await client.query(`UPDATE ml_model SET champion = true WHERE id = $1`, [body.model_id]);
      return Response.json({ ok: true });
    }
    const result = await client.query(
      `INSERT INTO ml_model (model_name, model_type, version, accuracy, f1_score, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.model_name ?? '', body.model_type ?? '', body.version ?? '1.0', body.accuracy ?? null, body.f1_score ?? null, body.status ?? 'staging']
    );
    return Response.json({ model: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
