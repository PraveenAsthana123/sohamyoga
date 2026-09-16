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
    const phase = searchParams.get('phase');
    const status = searchParams.get('status');

    let sql = `SELECT * FROM ai_transformation_roadmap WHERE 1=1`;
    const params: string[] = [];
    let idx = 1;
    if (phase) { sql += ` AND phase = $${idx++}`; params.push(phase); }
    if (status) { sql += ` AND status = $${idx++}`; params.push(status); }
    sql += ` ORDER BY phase, priority DESC, created_at`;

    const result = await query(sql, params);
    return Response.json({ initiatives: result.rows });
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
      initiative_name: string;
      phase?: string;
      priority?: string;
      status?: string;
      owner?: string;
      start_date?: string;
      end_date?: string;
      business_value?: string;
      ai_capability?: string;
      data_required?: string;
      model_type?: string;
      deployment?: string;
      estimated_roi_pct?: number;
      risk_level?: string;
      dependencies?: string[];
      success_metrics?: string[];
      notes?: string;
    };

    if (!body.initiative_name?.trim()) {
      return Response.json({ error: 'initiative_name is required' }, { status: 400 });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO ai_transformation_roadmap
        (initiative_name, phase, priority, status, owner, start_date, end_date, business_value,
         ai_capability, data_required, model_type, deployment, estimated_roi_pct, risk_level,
         dependencies, success_metrics, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        body.initiative_name.trim(),
        body.phase ?? 'foundation',
        body.priority ?? 'medium',
        body.status ?? 'planned',
        body.owner ?? null,
        body.start_date ?? null,
        body.end_date ?? null,
        body.business_value ?? null,
        body.ai_capability ?? null,
        body.data_required ?? null,
        body.model_type ?? null,
        body.deployment ?? null,
        body.estimated_roi_pct ?? null,
        body.risk_level ?? 'medium',
        body.dependencies ?? [],
        body.success_metrics ?? [],
        body.notes ?? null,
      ]
    );

    const created = await query(`SELECT * FROM ai_transformation_roadmap WHERE id = $1`, [result.rows[0].id]);
    return Response.json({ initiative: created.rows[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
