export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const { id } = params;
    const [model, assessments] = await Promise.all([
      query(`SELECT * FROM ai_model_registry WHERE id = $1`, [id]),
      query(
        `SELECT * FROM responsible_ai_assessments WHERE model_id = $1 ORDER BY reviewed_at DESC`,
        [id]
      ),
    ]);

    if (model.rowCount === 0) return Response.json({ error: 'Model not found' }, { status: 404 });
    return Response.json({ model: model.rows[0], assessments: assessments.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const { id } = params;
    const body = await req.json() as Record<string, unknown>;

    const allowed = ['model_name','model_type','framework','version','status','deployment_env',
      'endpoint_url','use_case','owner','performance_metrics_json','explainability_method',
      'bias_tested','fairness_score','carbon_footprint_kg','cost_per_1k_calls'];

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx++}`);
        vals.push(key === 'performance_metrics_json' ? JSON.stringify(body[key]) : body[key]);
      }
    }

    if (sets.length === 0) return Response.json({ error: 'No valid fields to update' }, { status: 400 });

    sets.push(`last_updated_at = NOW()`);
    vals.push(id);

    const result = await query(
      `UPDATE ai_model_registry SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );

    if (result.rowCount === 0) return Response.json({ error: 'Model not found' }, { status: 404 });
    return Response.json({ model: result.rows[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
