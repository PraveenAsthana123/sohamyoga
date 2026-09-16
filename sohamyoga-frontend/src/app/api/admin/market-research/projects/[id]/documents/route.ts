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
    id: string; project_id: string; scenario_id: string; document_type: string;
    title: string; content: string; format: string; word_count: string;
    generated_by: string; version: string; is_published: boolean; created_at: string;
  }>(`SELECT * FROM market_research_document WHERE project_id = $1 ORDER BY created_at DESC`, [id]);

  return Response.json({
    documents: rows.rows.map(r => ({
      id: Number(r.id), projectId: Number(r.project_id),
      scenarioId: r.scenario_id ? Number(r.scenario_id) : null,
      documentType: r.document_type, title: r.title, content: r.content,
      format: r.format, wordCount: Number(r.word_count),
      generatedBy: r.generated_by, version: Number(r.version),
      isPublished: r.is_published, createdAt: r.created_at,
    })),
  });
}
