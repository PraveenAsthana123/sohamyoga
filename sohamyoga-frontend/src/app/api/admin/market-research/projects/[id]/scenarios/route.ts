import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const { id } = await params;
  const rows = await query<{
    id: string; project_id: string; scenario_name: string; scenario_type: string;
    description: string; data_sources: string; methodology: string; status: string;
    output_format: string; ai_assisted: boolean; result_summary: string;
    result_data: Record<string, unknown>; created_at: string; completed_at: string;
  }>(`SELECT * FROM market_research_scenario WHERE project_id = $1 ORDER BY created_at DESC`, [id]);

  return Response.json({
    scenarios: rows.rows.map(r => ({
      id: Number(r.id), projectId: Number(r.project_id),
      scenarioName: r.scenario_name, scenarioType: r.scenario_type,
      description: r.description, dataSources: r.data_sources,
      methodology: r.methodology, status: r.status,
      outputFormat: r.output_format, aiAssisted: r.ai_assisted,
      resultSummary: r.result_summary, resultData: r.result_data,
      createdAt: r.created_at, completedAt: r.completed_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    scenario_name?: string; scenario_type?: string; description?: string;
    data_sources?: string; methodology?: string; output_format?: string;
    ai_assisted?: boolean;
  } | null;

  if (!body?.scenario_name?.trim()) {
    return Response.json({ error: 'scenario_name is required.' }, { status: 400 });
  }

  const result = await query<{ id: string }>(
    `INSERT INTO market_research_scenario
       (project_id, scenario_name, scenario_type, description, data_sources, methodology, output_format, ai_assisted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      id, body.scenario_name.trim(),
      body.scenario_type ?? 'secondary_research',
      body.description ?? '',
      body.data_sources ?? '',
      body.methodology ?? '',
      body.output_format ?? 'short_report',
      body.ai_assisted ?? false,
    ],
  );

  return Response.json({ id: Number(result.rows[0].id) }, { status: 201 });
}
