import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; name: string; category: string; status: string; owner: string;
    description: string; target_market: string; geography: string; industry: string;
    tags: string; created_at: string; updated_at: string;
    scenario_count: string; doc_count: string;
  }>(
    `SELECT p.id, p.name, p.category, p.status, p.owner, p.description,
            p.target_market, p.geography, p.industry, p.tags,
            p.created_at, p.updated_at,
            COUNT(DISTINCT s.id)::text AS scenario_count,
            COUNT(DISTINCT d.id)::text AS doc_count
     FROM market_research_project p
     LEFT JOIN market_research_scenario s ON s.project_id = p.id
     LEFT JOIN market_research_document d ON d.project_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
  );

  return Response.json({
    projects: rows.rows.map(r => ({
      id: Number(r.id),
      name: r.name,
      category: r.category,
      status: r.status,
      owner: r.owner,
      description: r.description,
      targetMarket: r.target_market,
      geography: r.geography,
      industry: r.industry,
      tags: r.tags,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      scenarioCount: Number(r.scenario_count),
      docCount: Number(r.doc_count),
    })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    name?: string; category?: string; description?: string;
    target_market?: string; geography?: string; industry?: string;
    owner?: string; tags?: string;
  } | null;

  if (!body?.name?.trim()) {
    return Response.json({ error: 'name is required.' }, { status: 400 });
  }

  const result = await query<{ id: string }>(
    `INSERT INTO market_research_project
       (name, category, description, target_market, geography, industry, owner, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      body.name.trim(),
      body.category ?? 'market_sizing',
      body.description ?? '',
      body.target_market ?? '',
      body.geography ?? '',
      body.industry ?? '',
      body.owner ?? '',
      body.tags ?? '',
    ],
  );

  return Response.json({ id: Number(result.rows[0].id) }, { status: 201 });
}
