import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Research Project -- the foundation of the Market Research Control Tower
// blueprint's "Screen 02 — Research Project Portfolio". Distinct from the
// curated research_framework/research_topic knowledge base: this is an
// actual project the studio runs, with its own real research questions.
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query<{
    id: string; title: string; objective: string; status: string; created_by: string; created_at: string;
    question_count: string;
  }>(
    `SELECT p.id, p.title, p.objective, p.status, p.created_by, p.created_at,
            COUNT(q.id) AS question_count
     FROM research_project p LEFT JOIN research_question q ON q.project_id = p.id
     WHERE p.tenant_id = $1 GROUP BY p.id ORDER BY p.created_at DESC`,
    [tenantId],
  );
  return Response.json({
    projects: rows.rows.map(r => ({
      id: r.id, title: r.title, objective: r.objective, status: r.status,
      createdBy: r.created_by, createdAt: r.created_at, questionCount: Number(r.question_count),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { title?: string; objective?: string } | null;
  if (!body?.title?.trim() || !body.objective?.trim()) {
    return Response.json({ error: 'title and objective are required.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO research_project (tenant_id, title, objective, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
    [tenantId, body.title.trim(), body.objective.trim(), principal!.email ?? principal!.id],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
