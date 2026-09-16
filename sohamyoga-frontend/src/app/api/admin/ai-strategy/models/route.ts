export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const framework = searchParams.get('framework');

    let sql = `
      SELECT mr.*,
        COUNT(ra.id) AS assessment_count,
        ROUND(AVG(ra.score)) AS avg_rai_score
      FROM ai_model_registry mr
      LEFT JOIN responsible_ai_assessments ra ON ra.model_id = mr.id
      WHERE 1=1
    `;
    const params: string[] = [];
    let idx = 1;
    if (status) { sql += ` AND mr.status = $${idx++}`; params.push(status); }
    if (framework) { sql += ` AND mr.framework = $${idx++}`; params.push(framework); }
    sql += ` GROUP BY mr.id ORDER BY mr.status, mr.model_name`;

    const result = await query(sql, params);
    return Response.json({ models: result.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const body = await req.json() as {
      model_name: string;
      model_type?: string;
      framework?: string;
      version?: string;
      status?: string;
      deployment_env?: string;
      endpoint_url?: string;
      use_case?: string;
      owner?: string;
      performance_metrics_json?: Record<string, unknown>;
      explainability_method?: string;
      bias_tested?: boolean;
      fairness_score?: number;
      carbon_footprint_kg?: number;
      cost_per_1k_calls?: number;
    };

    if (!body.model_name?.trim()) {
      return Response.json({ error: 'model_name is required' }, { status: 400 });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO ai_model_registry
        (model_name, model_type, framework, version, status, deployment_env, endpoint_url,
         use_case, owner, performance_metrics_json, explainability_method, bias_tested,
         fairness_score, carbon_footprint_kg, cost_per_1k_calls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        body.model_name.trim(),
        body.model_type ?? null,
        body.framework ?? null,
        body.version ?? null,
        body.status ?? 'active',
        body.deployment_env ?? 'local',
        body.endpoint_url ?? null,
        body.use_case ?? null,
        body.owner ?? null,
        JSON.stringify(body.performance_metrics_json ?? {}),
        body.explainability_method ?? null,
        body.bias_tested ?? false,
        body.fairness_score ?? null,
        body.carbon_footprint_kg ?? null,
        body.cost_per_1k_calls ?? null,
      ]
    );

    const created = await query(`SELECT * FROM ai_model_registry WHERE id = $1`, [result.rows[0].id]);
    return Response.json({ model: created.rows[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
